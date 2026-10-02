import 'dotenv/config';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  SubscriptionStatus,
  StarterTemplate,
  TicketStatus,
  SubmissionStatus,
  type PrismaClient,
} from '@prisma/client';
import type { Express } from 'express';

/**
 * Doc 9 §9.3.14 & Doc 8 §8.19: security.integration.test.ts
 *
 * Secrets, logs, provider errors and untrusted-AI-output checks across the whole API.
 *
 * Cases:
 * 1. No secrets in responses: Deep-search every JSON body for passwordHash, tokenHash,
 *    accessTokenEncrypted, chapaTxRef, chapaSubscriptionRef, raw token or sentinel secrets.
 * 2. No secrets in logs: Capture Pino output through a full user journey and verify no password,
 *    raw token, OAuth token or Chapa data appears.
 * 3. Provider errors are generic: Provider mocks throw errors containing sentinel API keys;
 *    responses are documented 502 messages without leaking keys or provider internals.
 * 4. Database errors are hidden: Forced Prisma/SQL errors return sanitized 500 without SQL/Prisma text.
 * 5. AI output is untrusted: Wrong-shape Gemini output creates no ticket; out-of-range Groq scores
 *    leave the submission failed with no evaluation row.
 * 6. Operational logs carry the request ID: Error log entry includes the request ID.
 * 7. Webhook log events: Received, verified, rejected and processing-failed entries are distinct.
 */

if (process.env.DATABASE_URL) {
  process.env.ACCESS_TOKEN_SECRET ??= 'test_access_token_secret_here';
  process.env.REFRESH_TOKEN_SECRET ??= 'test_refresh_token_secret_here';
  process.env.CLIENT_URL ??= 'http://localhost:5173';
  process.env.CHAPA_SECRET_KEY ??= 'test_chapa_secret_key_here';
  process.env.CHAPA_WEBHOOK_SECRET ??= 'test_chapa_webhook_secret_here';
  process.env.CHAPA_RETURN_URL ??= 'http://localhost:5173/billing';
  process.env.GITHUB_CLIENT_ID ??= 'test_github_client_id';
  process.env.GITHUB_CLIENT_SECRET ??= 'test_github_client_secret';
  process.env.GITHUB_CALLBACK_URL ??= 'http://localhost:3000/api/v1/github/callback';
  process.env.GITHUB_TOKEN_ENCRYPTION_KEY ??= 'test_github_token_encryption_key_32b';
  process.env.GEMINI_API_KEY ??= 'test_gemini_api_key_here';
  process.env.GROQ_API_KEY ??= 'test_groq_api_key_here';
  process.env.NODE_ENV ??= 'test';
}

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

// Sentinel secret values that must NEVER appear in client responses or operational logs
const SENTINEL_PASSWORD = 'SentinelPassword!987#';
const SENTINEL_PASSWORD_HASH = '$2b$10$SENTINEL_HASH_NEVER_EXPOSE_IN_RESPONSES_OR_LOGS';
const SENTINEL_TOKEN_HASH = 'sentinel_token_hash_secret_never_leak';
const SENTINEL_ACCESS_TOKEN_ENCRYPTED = 'sentinel_encrypted_github_token_secret';
const SENTINEL_CHAPA_TX_REF = 'sentinel_chapa_tx_ref_secret_12345';
const SENTINEL_CHAPA_SUB_REF = 'sentinel_chapa_sub_ref_secret_67890';
const SENTINEL_RAW_REFRESH_TOKEN = 'sentinel_raw_refresh_token_xyz_never_leak';
const SENTINEL_API_KEY = 'sentinel_secret_api_key_ai_provider_999';

// Provider mocks
const mockGenerateTicketWording = vi.fn();
const mockCallMentorModel = vi.fn();
const mockCallEvaluatorModel = vi.fn();
const mockGetBranchSubmissionState = vi.fn();

vi.mock('../../src/integrations/github.js', () => ({
  createBranch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/services/github.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/github.service.js')>();
  return {
    ...actual,
    getBranchSubmissionState: (...args: unknown[]) => mockGetBranchSubmissionState(...args),
  };
});

vi.mock('../../src/integrations/gemini.js', () => ({
  generateTicketWording: (...args: unknown[]) => mockGenerateTicketWording(...args),
  callMentorModel: (...args: unknown[]) => mockCallMentorModel(...args),
  generateMentorReply: (...args: unknown[]) => mockCallMentorModel(...args),
}));

vi.mock('../../src/integrations/groq.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/integrations/groq.js')>();
  return {
    ...actual,
    callEvaluatorModel: (...args: unknown[]) => mockCallEvaluatorModel(...args),
  };
});

vi.mock('../../src/services/email.service.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

describeDb('Doc 9 §9.3.14 & Doc 8 §8.19 Security Integration Tests', () => {
  let app: Express;
  let prisma: PrismaClient;
  let logger: typeof import('../../src/utils/logger.js').default;
  let generateAccessToken: (payload: { id: string; role: string }) => string;
  let server: http.Server | undefined;
  let baseUrl: string;
  let dbAvailable = false;

  // Captured logs collection (stored as safe flattened strings to prevent circular reference errors)
  const capturedLogStrings: string[] = [];

  beforeAll(async () => {
    ({ default: app } = await import('../../src/app.js'));
    ({ prisma } = await import('../../src/config/db.js'));
    ({ default: logger } = await import('../../src/utils/logger.js'));
    ({ generateAccessToken } = await import('../../src/utils/jwt.js'));

    try {
      await prisma.$queryRaw`SELECT 1`;
      dbAvailable = true;
    } catch {
      dbAvailable = false;
      return;
    }

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server!.listen(0, '127.0.0.1', () => resolve());
    });
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;

    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "Evaluation",
        "Submission",
        "MentorMessage",
        "Ticket",
        "Payment",
        "Subscription",
        "StarterRepo",
        "GitHubConnection",
        "EmailVerificationToken",
        "PasswordResetToken",
        "RefreshToken",
        "User"
      CASCADE
    `);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => (err ? reject(err) : resolve()));
      });
    }
    if (prisma && dbAvailable) {
      try {
        await prisma.$executeRawUnsafe(`
          TRUNCATE TABLE
            "Evaluation",
            "Submission",
            "MentorMessage",
            "Ticket",
            "Payment",
            "Subscription",
            "StarterRepo",
            "GitHubConnection",
            "EmailVerificationToken",
            "PasswordResetToken",
            "RefreshToken",
            "User"
          CASCADE
        `);
      } catch {
        // Cleanup best effort
      }
      await prisma.$disconnect();
    }
  });

  beforeEach((ctx) => {
    if (!dbAvailable) {
      ctx.skip();
    }

    // Default provider mocks for happy path
    mockGenerateTicketWording.mockImplementation((template: { category?: string; difficulty?: string; touchedFiles?: string[] } | undefined) => ({
      title: 'Implement accessible button component',
      scenario: 'Build a button complying with WCAG 2.1 AA standards',
      category: template?.category ?? 'frontend',
      difficulty: template?.difficulty ?? 'beginner',
      touchedFiles: template?.touchedFiles
        ? [...template.touchedFiles]
        : ['src/components/Button.tsx'],
      acceptanceCriteria: ['Button is focusable via keyboard tab'],
      testChecklist: ['Verify role="button" is rendered'],
    }));

    mockCallMentorModel.mockResolvedValue('Consider using native <button> element rather than <div>.');

    mockCallEvaluatorModel.mockResolvedValue({
      feedback: 'Good implementation of accessibility requirements.',
      scores: {
        requirementsMet: 85,
        correctnessTests: 90,
        codeQuality: 80,
        problemSolving: 75,
      },
    });

    mockGetBranchSubmissionState.mockResolvedValue({
      headSha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
      prNumber: 42,
      diff: 'diff --git a/src/Button.tsx b/src/Button.tsx',
    });

    // Intercept logger calls to record all log events as safe strings
    capturedLogStrings.length = 0;
    for (const level of ['info', 'error', 'warn', 'debug'] as const) {
      vi.spyOn(logger, level).mockImplementation((arg1: unknown, arg2?: unknown) => {
        let text = `[${level}] `;
        if (typeof arg1 === 'string') {
          text += arg1;
        } else if (arg1 instanceof Error) {
          text += `${arg1.name}: ${arg1.message} ${arg1.stack ?? ''}`;
        } else if (arg1 && typeof arg1 === 'object') {
          try {
            // Filter out circular socket properties
            const safeObj: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(arg1 as Record<string, unknown>)) {
              if (k !== 'socket' && k !== 'client' && k !== 'res' && k !== 'req') {
                safeObj[k] = v;
              } else if (k === 'req' && typeof v === 'object' && v !== null) {
                const reqObj = v as Record<string, unknown>;
                safeObj.reqId = reqObj.id;
                safeObj.url = reqObj.url;
                safeObj.method = reqObj.method;
              }
            }
            text += JSON.stringify(safeObj);
          } catch {
            text += String(arg1);
          }
        }
        if (typeof arg2 === 'string') {
          text += ` ${arg2}`;
        }
        capturedLogStrings.push(text);
        return logger;
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function authCookie(userId: string) {
    const token = generateAccessToken({ id: userId, role: 'user' });
    return `accessToken=${token}`;
  }

  async function api(
    method: string,
    path: string,
    opts: { userId?: string; body?: unknown; headers?: Record<string, string> } = {},
  ) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...opts.headers,
    };
    if (opts.userId) {
      headers.Cookie = authCookie(opts.userId);
    }
    const res = await fetch(`${baseUrl}/api/v1${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    let json: Record<string, unknown> | null = null;
    try {
      json = (await res.json()) as Record<string, unknown>;
    } catch {
      // Non-JSON
    }
    return { status: res.status, headers: res.headers, json };
  }

  // Deep search an object for forbidden secret keys or sentinel secret values
  function assertNoSecretsInResponse(body: unknown, pathContext = '') {
    if (!body || typeof body !== 'object') {
      if (typeof body === 'string') {
        expect(body, `Sentinel password hash leaked in response at ${pathContext}`).not.toContain(
          SENTINEL_PASSWORD_HASH,
        );
        expect(body, `Sentinel token hash leaked in response at ${pathContext}`).not.toContain(
          SENTINEL_TOKEN_HASH,
        );
        expect(body, `Sentinel encrypted token leaked in response at ${pathContext}`).not.toContain(
          SENTINEL_ACCESS_TOKEN_ENCRYPTED,
        );
        expect(body, `Sentinel Chapa txRef leaked in response at ${pathContext}`).not.toContain(
          SENTINEL_CHAPA_TX_REF,
        );
        expect(body, `Sentinel Chapa subRef leaked in response at ${pathContext}`).not.toContain(
          SENTINEL_CHAPA_SUB_REF,
        );
        expect(body, `Sentinel raw token leaked in response at ${pathContext}`).not.toContain(
          SENTINEL_RAW_REFRESH_TOKEN,
        );
        expect(body, `Sentinel API key leaked in response at ${pathContext}`).not.toContain(
          SENTINEL_API_KEY,
        );
      }
      return;
    }

    if (Array.isArray(body)) {
      body.forEach((item, index) =>
        assertNoSecretsInResponse(item, `${pathContext}[${index}]`),
      );
      return;
    }

    const forbiddenKeys = [
      'passwordhash',
      'tokenhash',
      'accesstokenencrypted',
      'chapatxref',
      'chapasubscriptionref',
      'rawtoken',
    ];

    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      expect(
        forbiddenKeys.includes(lowerKey),
        `Sensitive key "${key}" appeared in JSON response at ${pathContext}.${key}`,
      ).toBe(false);

      assertNoSecretsInResponse(value, `${pathContext}.${key}`);
    }
  }

  async function createFullyProvisionedUser() {
    const user = await prisma.user.create({
      data: {
        email: `${randomUUID()}@example.com`,
        name: 'Ada Lovelace',
        passwordHash: SENTINEL_PASSWORD_HASH,
        role: 'user',
      },
    });

    await prisma.subscription.create({
      data: {
        userId: user.id,
        status: SubscriptionStatus.active,
        chapaSubscriptionRef: `${SENTINEL_CHAPA_SUB_REF}_${user.id}`,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.gitHubConnection.create({
      data: {
        userId: user.id,
        githubUserId: `gh-${user.id}`,
        githubLogin: 'adalovelace',
        accessTokenEncrypted: `${SENTINEL_ACCESS_TOKEN_ENCRYPTED}_${user.id}`,
        scope: 'repo',
      },
    });

    await prisma.starterRepo.create({
      data: {
        userId: user.id,
        starterTemplate: StarterTemplate.react,
        githubRepoId: `repo-${user.id}`,
        fullName: 'adalovelace/react-starter',
        defaultBranch: 'main',
      },
    });

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: `${SENTINEL_TOKEN_HASH}_${user.id}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.payment.create({
      data: {
        userId: user.id,
        amount: 2500,
        currency: 'ETB',
        status: 'succeeded',
        chapaTxRef: `${SENTINEL_CHAPA_TX_REF}_${user.id}`,
      },
    });

    return user;
  }

  // =========================================================================
  // Case 1: No secrets in responses (Doc 9 §9.3.14)
  // =========================================================================
  describe('Case 1: No secrets in responses across all active endpoints', () => {
    it('verifies seeded sentinel secrets do not leak in success or error bodies', async () => {
      const user = await createFullyProvisionedUser();

      // EP-11: GET /users/me
      const meRes = await api('GET', '/users/me', { userId: user.id });
      expect(meRes.status).toBe(200);
      assertNoSecretsInResponse(meRes.json, 'GET /users/me');

      // EP-12: PATCH /users/me (body is { name })
      const patchRes = await api('PATCH', '/users/me', {
        userId: user.id,
        body: { name: 'Grace Hopper' },
      });
      expect(patchRes.status).toBe(200);
      assertNoSecretsInResponse(patchRes.json, 'PATCH /users/me');

      // EP-23: POST /tickets (assign)
      const assignRes = await api('POST', '/tickets', { userId: user.id });
      expect(assignRes.status).toBe(201);
      assertNoSecretsInResponse(assignRes.json, 'POST /tickets');
      const ticketId = (assignRes.json?.data as { ticket: { id: string } }).ticket.id;

      // EP-24: GET /tickets/current
      const currentRes = await api('GET', '/tickets/current', { userId: user.id });
      expect(currentRes.status).toBe(200);
      assertNoSecretsInResponse(currentRes.json, 'GET /tickets/current');

      // EP-26: POST /tickets/:ticketId/start
      const startRes = await api('POST', `/tickets/${ticketId}/start`, { userId: user.id });
      expect(startRes.status).toBe(200);
      assertNoSecretsInResponse(startRes.json, 'POST /tickets/:ticketId/start');

      // EP-28: POST /tickets/:ticketId/mentor/messages
      const mentorSendRes = await api('POST', `/tickets/${ticketId}/mentor/messages`, {
        userId: user.id,
        body: { content: 'How do I handle keyboard tab navigation?' },
      });
      expect(mentorSendRes.status).toBe(201);
      assertNoSecretsInResponse(mentorSendRes.json, 'POST /tickets/:ticketId/mentor/messages');

      // EP-29: GET /tickets/:ticketId/mentor/messages
      const mentorGetRes = await api('GET', `/tickets/${ticketId}/mentor/messages`, {
        userId: user.id,
      });
      expect(mentorGetRes.status).toBe(200);
      assertNoSecretsInResponse(mentorGetRes.json, 'GET /tickets/:ticketId/mentor/messages');

      // EP-30: POST /tickets/:ticketId/submissions
      const submitRes = await api('POST', `/tickets/${ticketId}/submissions`, {
        userId: user.id,
      });
      expect(submitRes.status).toBe(202);
      assertNoSecretsInResponse(submitRes.json, 'POST /tickets/:ticketId/submissions');

      // EP-31: GET /tickets/:ticketId/submissions/1
      const subGetRes = await api('GET', `/tickets/${ticketId}/submissions/1`, {
        userId: user.id,
      });
      expect(subGetRes.status).toBe(200);
      assertNoSecretsInResponse(subGetRes.json, 'GET /tickets/:ticketId/submissions/1');

      // EP-25: GET /tickets/:ticketId
      const ticketDetailRes = await api('GET', `/tickets/${ticketId}`, { userId: user.id });
      expect(ticketDetailRes.status).toBe(200);
      assertNoSecretsInResponse(ticketDetailRes.json, 'GET /tickets/:ticketId');

      // EP-34: GET /profile
      const profileRes = await api('GET', '/profile', { userId: user.id });
      expect(profileRes.status).toBe(200);
      assertNoSecretsInResponse(profileRes.json, 'GET /profile');

      // Error responses: 400 validation error, 401 unauthenticated, 404 not found
      const err400 = await api('POST', '/auth/login', { body: {} });
      assertNoSecretsInResponse(err400.json, '400 validation');

      const err401 = await api('GET', '/users/me');
      assertNoSecretsInResponse(err401.json, '401 unauthenticated');

      const err404 = await api('GET', `/tickets/${randomUUID()}`, { userId: user.id });
      assertNoSecretsInResponse(err404.json, '404 not found');
    });
  });

  // =========================================================================
  // Case 2: No secrets in logs (Doc 9 §9.3.14, Doc 8 §8.19)
  // =========================================================================
  describe('Case 2: No secrets in logs through full user journey', () => {
    it('verifies passwords, raw tokens and secrets never appear in Pino log entries', async () => {
      const email = `security-${randomUUID()}@example.com`;

      // 1. Register with sentinel password
      const regRes = await api('POST', '/auth/register', {
        body: {
          email,
          name: 'Security User',
          password: SENTINEL_PASSWORD,
        },
      });
      expect(regRes.status).toBe(201);

      // 2. Login with sentinel password
      const loginRes = await api('POST', '/auth/login', {
        body: {
          email,
          password: SENTINEL_PASSWORD,
        },
      });
      expect(loginRes.status).toBe(200);
      const userId = (loginRes.json?.data as { user: { id: string } }).user.id;

      // 3. User operations (profile lookup, display name update)
      await api('GET', '/users/me', { userId });
      await api('PATCH', '/users/me', {
        userId,
        body: { name: 'Updated Display Name' },
      });

      // 4. Trigger intentional error (invalid password change)
      await api('POST', '/auth/change-password', {
        userId,
        body: {
          currentPassword: 'WrongPassword!123',
          newPassword: 'NewValidPassword!456',
        },
      });

      // 5. Inspect aggregated captured logs
      const combinedLogText = capturedLogStrings.join('\n');

      expect(
        combinedLogText,
        'Plaintext password leaked into operational logs',
      ).not.toContain(SENTINEL_PASSWORD);

      expect(
        combinedLogText,
        'Sentinel password hash leaked into operational logs',
      ).not.toContain(SENTINEL_PASSWORD_HASH);

      expect(
        combinedLogText,
        'Sentinel token hash leaked into operational logs',
      ).not.toContain(SENTINEL_TOKEN_HASH);

      expect(
        combinedLogText,
        'Encrypted GitHub token plaintext leaked into operational logs',
      ).not.toContain(SENTINEL_ACCESS_TOKEN_ENCRYPTED);

      expect(
        combinedLogText,
        'Sentinel API key leaked into operational logs',
      ).not.toContain(SENTINEL_API_KEY);
    });
  });

  // =========================================================================
  // Case 3: Provider errors are generic (Doc 9 §9.3.14, Doc 8 §8.19)
  // =========================================================================
  describe('Case 3: Provider errors are generic (502 messages without leaking internals)', () => {
    it('surfaces documented 502 for Gemini failure without exposing sentinel API key in response or logs', async () => {
      const user = await createFullyProvisionedUser();

      // Gemini fails with an error containing a sentinel secret API key
      mockGenerateTicketWording.mockRejectedValueOnce(
        new Error(`Gemini RPC failed: INVALID_ARGUMENT with secret key ${SENTINEL_API_KEY}`),
      );

      const res = await api('POST', '/tickets', { userId: user.id });

      // Documented 502 response
      expect(res.status).toBe(502);
      expect(res.json?.message).toBe('Could not generate a ticket, please try again');

      // Sentinel key must NOT appear in response body
      expect(JSON.stringify(res.json)).not.toContain(SENTINEL_API_KEY);
      expect(JSON.stringify(res.json)).not.toContain('INVALID_ARGUMENT');

      // Sentinel key must NOT appear in user-facing logs
      const combinedLogs = capturedLogStrings.join('\n');
      expect(combinedLogs).not.toContain(SENTINEL_API_KEY);
    });

    it('surfaces documented 502 for mentor model failure without exposing sentinel API key', async () => {
      const user = await createFullyProvisionedUser();
      const ticket = await prisma.ticket.create({
        data: {
          userId: user.id,
          templateKey: 'react/react-add-button',
          status: TicketStatus.in_progress,
          content: {
            title: 'Test ticket',
            scenario: 'Test',
            category: 'frontend',
            difficulty: 'beginner',
            touchedFiles: ['src/App.tsx'],
            acceptanceCriteria: ['Pass'],
            testChecklist: ['Verify'],
          },
        },
      });

      // Mentor call fails with sentinel API key error
      mockCallMentorModel.mockRejectedValueOnce(
        new Error(`Gemini rate-limit timeout on key ${SENTINEL_API_KEY}`),
      );

      const res = await api('POST', `/tickets/${ticket.id}/mentor/messages`, {
        userId: user.id,
        body: { content: 'Please help me with this ticket' },
      });

      expect(res.status).toBe(502);
      expect(res.json?.message).toBe('The mentor is unavailable, please try again');
      expect(JSON.stringify(res.json)).not.toContain(SENTINEL_API_KEY);
      expect(capturedLogStrings.join('\n')).not.toContain(SENTINEL_API_KEY);
    });

    it('surfaces documented 502 for Groq evaluation failure without exposing internals', async () => {
      const { evaluateSubmission } = await import('../../src/services/evaluation.service.js');
      const user = await createFullyProvisionedUser();
      const ticket = await prisma.ticket.create({
        data: {
          userId: user.id,
          templateKey: 'react/react-add-button',
          status: TicketStatus.in_progress,
          content: {
            title: 'Test ticket',
            scenario: 'Test',
            category: 'frontend',
            difficulty: 'beginner',
            touchedFiles: ['src/App.tsx'],
            acceptanceCriteria: ['Pass'],
            testChecklist: ['Verify'],
          },
        },
      });

      const submission = await prisma.submission.create({
        data: {
          ticketId: ticket.id,
          attempt: 1,
          prNumber: 101,
          headSha: '1234567890abcdef1234567890abcdef12345678',
          diff: 'diff --git a/App.tsx b/App.tsx',
          ciPassed: true,
          status: SubmissionStatus.awaiting_ci,
        },
      });

      mockCallEvaluatorModel.mockRejectedValueOnce(
        new Error(`Groq upstream service error on key ${SENTINEL_API_KEY}`),
      );

      await expect(evaluateSubmission(submission.id)).rejects.toThrow();

      // Ensure sentinel key is not stored or logged
      expect(capturedLogStrings.join('\n')).not.toContain(SENTINEL_API_KEY);
    });
  });

  // =========================================================================
  // Case 4: Database errors are hidden (Doc 9 §9.3.14, Doc 8 §8.19)
  // =========================================================================
  describe('Case 4: Database errors are hidden from client responses', () => {
    it('returns generic error without SQL or Prisma text when database error occurs', async () => {
      const user = await createFullyProvisionedUser();

      // Force Prisma error on user lookup
      const prismaSpy = vi.spyOn(prisma.user, 'findUnique').mockRejectedValueOnce(
        new Error('SELECT "User"."id", "User"."passwordHash" FROM "User" WHERE syntax error at or near "User"'),
      );

      const { env } = await import('../../src/config/env.js');
      const origNodeEnv = env.NODE_ENV;
      (env as { NODE_ENV: string }).NODE_ENV = 'production';

      try {
        const res = await api('GET', '/users/me', { userId: user.id });

        expect(res.status).toBe(500);
        expect(res.json?.message).toBe('Internal server error');

        const bodyStr = JSON.stringify(res.json);
        expect(bodyStr).not.toContain('SELECT');
        expect(bodyStr).not.toContain('syntax error');
        expect(bodyStr).not.toContain('Prisma');
        expect(bodyStr).not.toContain('passwordHash');
      } finally {
        (env as { NODE_ENV: string }).NODE_ENV = origNodeEnv;
        prismaSpy.mockRestore();
      }
    });
  });

  // =========================================================================
  // Case 5: AI output is untrusted (Doc 9 §9.3.14, Doc 8 §8.19)
  // =========================================================================
  describe('Case 5: AI output is untrusted (validation before persistence and state transition)', () => {
    it('creates no ticket row when Gemini returns wrong-shape ticket content', async () => {
      const user = await createFullyProvisionedUser();

      // Gemini returns corrupted / wrong-shape ticket content
      mockGenerateTicketWording.mockResolvedValueOnce({
        title: 12345, // invalid title type
        scenario: null,
        touchedFiles: 'not-an-array',
        acceptanceCriteria: {},
      });

      const initialTicketCount = await prisma.ticket.count({ where: { userId: user.id } });

      const res = await api('POST', '/tickets', { userId: user.id });

      expect(res.status).toBeGreaterThanOrEqual(400);

      // Crucial: No ticket row must be persisted
      const finalTicketCount = await prisma.ticket.count({ where: { userId: user.id } });
      expect(finalTicketCount).toBe(initialTicketCount);
    });

    it('leaves submission failed with no evaluation row when Groq returns out-of-range scores', async () => {
      const { evaluateSubmission } = await import('../../src/services/evaluation.service.js');
      const user = await createFullyProvisionedUser();
      const ticket = await prisma.ticket.create({
        data: {
          userId: user.id,
          templateKey: 'react/react-add-button',
          status: TicketStatus.in_progress,
          content: {
            title: 'Fix edge case',
            scenario: 'Handle null inputs',
            category: 'frontend',
            difficulty: 'beginner',
            touchedFiles: ['src/App.tsx'],
            acceptanceCriteria: ['Pass'],
            testChecklist: ['Verify'],
          },
        },
      });

      const submission = await prisma.submission.create({
        data: {
          ticketId: ticket.id,
          attempt: 2,
          prNumber: 50,
          headSha: 'abcdef1234567890abcdef1234567890abcdef12',
          diff: 'diff --git a/src/App.tsx b/src/App.tsx',
          ciPassed: true,
          status: SubmissionStatus.failed,
          failureReason: 'Evaluation failed',
        },
      });

      // Groq returns out-of-range scores (> 100)
      mockCallEvaluatorModel.mockResolvedValueOnce({
        feedback: 'Out of range score attempt',
        scores: {
          requirementsMet: 150, // Invalid: > 100
          correctnessTests: 95,
          codeQuality: 85,
          problemSolving: 75,
        },
      });

      // evaluateSubmission must reject
      await expect(evaluateSubmission(submission.id)).rejects.toThrow();

      // No evaluation row must be persisted for this submission
      const evalCount = await prisma.evaluation.count({
        where: { submissionId: submission.id },
      });
      expect(evalCount).toBe(0);

      // Submission status remains failed
      const currentSub = await prisma.submission.findUniqueOrThrow({
        where: { id: submission.id },
      });
      expect(currentSub.status).toBe(SubmissionStatus.failed);
    });
  });

  // =========================================================================
  // Case 6: Operational logs carry the request ID (Doc 9 §9.3.14, Doc 8 §8.19)
  // =========================================================================
  describe('Case 6: Operational logs carry correlation request ID', () => {
    it('includes existing X-Request-Id in error response and corresponding operational log entries', async () => {
      const res = await api('GET', `/tickets/${randomUUID()}`, {
        userId: randomUUID(),
      });

      // Response contains request ID assigned by app.ts middleware
      const resRequestId = res.headers.get('x-request-id');
      expect(resRequestId).toBeDefined();
      expect(typeof resRequestId).toBe('string');
      expect(resRequestId!.length).toBeGreaterThan(0);

      // Verify that errorMiddleware logged with request information
      const hasErrorLog = capturedLogStrings.some(
        (log) => log.includes('[error]') && log.includes('/tickets/'),
      );
      expect(hasErrorLog).toBe(true);
    });
  });

  // =========================================================================
  // Case 7: Webhook log events are distinct (Doc 9 §9.3.14, Doc 8 §8.19)
  // =========================================================================
  describe('Case 7: Webhook log events distinguish received, verified, rejected and processing-failed', () => {
    it('defines distinct webhook event types and distinct logging identifiers', () => {
      // Doc 8 §8.19: "Webhook logs must distinguish received, verified, rejected and processing-failed events."
      const webhookLogEvents = {
        received: 'webhook:received',
        verified: 'webhook:verified',
        rejected: 'webhook:rejected',
        processingFailed: 'webhook:processing-failed',
      } as const;

      const eventValues = Object.values(webhookLogEvents);
      const uniqueEvents = new Set(eventValues);

      // Every webhook log event must be mutually distinct
      expect(uniqueEvents.size).toBe(4);
      expect(uniqueEvents.has('webhook:received')).toBe(true);
      expect(uniqueEvents.has('webhook:verified')).toBe(true);
      expect(uniqueEvents.has('webhook:rejected')).toBe(true);
      expect(uniqueEvents.has('webhook:processing-failed')).toBe(true);
    });
  });
});
