import 'dotenv/config';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import {
  afterAll,
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
import type { TicketTemplate } from '../../src/types/domain.js';

/**
 * Doc 9 §9.3.12 — submission routes against real Postgres.
 * Skips when DATABASE_URL is unset. Webhook → Groq → done (full two-pass)
 * still needs BE-065; covered here up through submit / poll / retry / gates.
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

const createBranch = vi.fn();
const generateTicketWording = vi.fn();
const getBranchSubmissionState = vi.fn();
const startSubmissionPipeline = vi.fn();

vi.mock('../../src/integrations/github.js', () => ({
  createBranch: (...args: unknown[]) => createBranch(...args),
}));

vi.mock('../../src/integrations/gemini.js', () => ({
  generateTicketWording: (...args: unknown[]) => generateTicketWording(...args),
}));

vi.mock('../../src/services/github.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/github.service.js')>();
  return {
    ...actual,
    getBranchSubmissionState: (...args: unknown[]) => getBranchSubmissionState(...args),
  };
});

vi.mock('../../src/services/submission-pipeline.js', () => ({
  startSubmissionPipeline: (...args: unknown[]) => startSubmissionPipeline(...args),
}));

function defaultWording(template: TicketTemplate) {
  return {
    title: `${template.category}: ${template.key}`,
    scenario: `Implement ${template.key}`,
    category: template.category,
    difficulty: template.difficulty,
    touchedFiles: [...template.touchedFiles],
    acceptanceCriteria: ['a'],
    testChecklist: ['b'],
  };
}

const branchState = {
  fullName: 'ada/starter',
  branchName: 'ticket/x',
  defaultBranch: 'main',
  prNumber: 7,
  prUrl: 'https://github.com/ada/starter/pull/7',
  headSha: 'deadbeef',
  diff: 'diff --git a/App.tsx\n+export const x = 1;',
};

describeDb('submission-pipeline (Doc 9 §9.3.12)', () => {
  let app: Express;
  let prisma: PrismaClient;
  let generateAccessToken: (payload: { id: string; role: string }) => string;
  let server: http.Server | undefined;
  let baseUrl: string;
  let dbAvailable = false;

  beforeAll(async () => {
    ({ default: app } = await import('../../src/app.js'));
    ({ prisma } = await import('../../src/config/db.js'));
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
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => (err ? reject(err) : resolve()));
      });
    }
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  beforeEach(async (ctx) => {
    if (!dbAvailable) {
      ctx.skip();
      return;
    }

    vi.clearAllMocks();
    createBranch.mockResolvedValue(undefined);
    startSubmissionPipeline.mockResolvedValue(undefined);
    getBranchSubmissionState.mockResolvedValue(branchState);
    generateTicketWording.mockImplementation(async (template: TicketTemplate) =>
      defaultWording(template),
    );

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

  async function createUser(email = `${randomUUID()}@example.com`) {
    return prisma.user.create({
      data: { email, passwordHash: 'hash', role: 'user' },
    });
  }

  async function seedReadyUser() {
    const user = await createUser();
    await prisma.subscription.create({
      data: {
        userId: user.id,
        status: SubscriptionStatus.active,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.gitHubConnection.create({
      data: {
        userId: user.id,
        githubUserId: `gh-${user.id}`,
        githubLogin: 'ada',
        accessTokenEncrypted: 'enc-token',
        scope: 'repo',
      },
    });
    await prisma.starterRepo.create({
      data: {
        userId: user.id,
        starterTemplate: StarterTemplate.react,
        githubRepoId: `repo-${user.id}`,
        fullName: 'ada/starter',
        defaultBranch: 'main',
      },
    });
    return user;
  }

  function authCookie(userId: string) {
    const token = generateAccessToken({ id: userId, role: 'user' });
    return `accessToken=${token}`;
  }

  async function api(
    method: string,
    path: string,
    opts: { userId?: string; body?: unknown } = {},
  ) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (opts.userId) {
      headers.Cookie = authCookie(opts.userId);
    }
    const res = await fetch(`${baseUrl}/api/v1${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const json = (await res.json()) as {
      statusCode: number;
      success: boolean;
      message: string;
      data: unknown;
    };
    return { status: res.status, json };
  }

  async function startInProgressTicket(userId: string) {
    const assigned = await api('POST', '/tickets', { userId });
    expect(assigned.status).toBe(201);
    const ticketId = (assigned.json.data as { ticket: { id: string } }).ticket.id;
    const started = await api('POST', `/tickets/${ticketId}/start`, { userId });
    expect(started.status).toBe(200);
    return ticketId;
  }

  it('submit attempt 1 — 202 awaiting_ci, ticket submitted_v1, stores diff', async () => {
    const user = await seedReadyUser();
    const ticketId = await startInProgressTicket(user.id);

    const { status, json } = await api('POST', `/tickets/${ticketId}/submissions`, {
      userId: user.id,
      body: { attempt: 2 },
    });

    expect(status).toBe(202);
    expect(json.message).toBe('Submission received');
    const data = json.data as {
      submission: { attempt: number; status: string; prNumber: number; diff?: string };
    };
    expect(data.submission.attempt).toBe(1);
    expect(data.submission.status).toBe('awaiting_ci');
    expect(data.submission.prNumber).toBe(7);
    expect(data.submission).not.toHaveProperty('diff');

    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    expect(ticket.status).toBe(TicketStatus.submitted_v1);

    const row = await prisma.submission.findUniqueOrThrow({
      where: { ticketId_attempt: { ticketId, attempt: 1 } },
    });
    expect(row.diff).toBe(branchState.diff);
    expect(startSubmissionPipeline).toHaveBeenCalledWith(row.id);
  });

  it('poll without includeDiff omits diff; with includeDiff=true returns it', async () => {
    const user = await seedReadyUser();
    const ticketId = await startInProgressTicket(user.id);
    await api('POST', `/tickets/${ticketId}/submissions`, { userId: user.id });

    const noDiff = await api('GET', `/tickets/${ticketId}/submissions/1`, {
      userId: user.id,
    });
    expect(noDiff.status).toBe(200);
    expect(
      (noDiff.json.data as { submission: Record<string, unknown> }).submission,
    ).not.toHaveProperty('diff');

    const withDiff = await api(
      'GET',
      `/tickets/${ticketId}/submissions/1?includeDiff=true`,
      { userId: user.id },
    );
    expect(withDiff.status).toBe(200);
    expect(
      (withDiff.json.data as { submission: { diff: string } }).submission.diff,
    ).toBe(branchState.diff);
  });

  it('resubmit too early while attempt 1 awaiting_ci returns 409', async () => {
    const user = await seedReadyUser();
    const ticketId = await startInProgressTicket(user.id);
    await api('POST', `/tickets/${ticketId}/submissions`, { userId: user.id });

    const again = await api('POST', `/tickets/${ticketId}/submissions`, {
      userId: user.id,
    });
    expect(again.status).toBe(409);
    expect(again.json.message).toBe(
      'Wait for feedback on your first submission before resubmitting',
    );
    expect(await prisma.submission.count({ where: { ticketId } })).toBe(1);
  });

  it('double submit — one 202 and one 409; single attempt-1 row', async () => {
    const user = await seedReadyUser();
    const ticketId = await startInProgressTicket(user.id);

    const [a, b] = await Promise.all([
      api('POST', `/tickets/${ticketId}/submissions`, { userId: user.id }),
      api('POST', `/tickets/${ticketId}/submissions`, { userId: user.id }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([202, 409]);
    expect(await prisma.submission.count({ where: { ticketId } })).toBe(1);
  });

  it('no commits from GitHub — 400; ticket stays in_progress', async () => {
    const user = await seedReadyUser();
    const ticketId = await startInProgressTicket(user.id);
    const { default: ApiError } = await import('../../src/utils/ApiError.js');
    getBranchSubmissionState.mockRejectedValueOnce(
      new ApiError(
        400,
        "No commits found on branch 'ticket/x'. Push your work before submitting",
      ),
    );

    const { status, json } = await api('POST', `/tickets/${ticketId}/submissions`, {
      userId: user.id,
    });
    expect(status).toBe(400);
    expect(json.message).toMatch(/No commits found/);

    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    expect(ticket.status).toBe(TicketStatus.in_progress);
    expect(await prisma.submission.count({ where: { ticketId } })).toBe(0);
  });

  it('retry failed submission — same row id, no third row', async () => {
    const user = await seedReadyUser();
    const ticketId = await startInProgressTicket(user.id);
    await api('POST', `/tickets/${ticketId}/submissions`, { userId: user.id });

    const existing = await prisma.submission.findUniqueOrThrow({
      where: { ticketId_attempt: { ticketId, attempt: 1 } },
    });
    await prisma.submission.update({
      where: { id: existing.id },
      data: { status: SubmissionStatus.failed, failureReason: 'CI cancelled' },
    });

    const { status, json } = await api(
      'POST',
      `/tickets/${ticketId}/submissions/1/retry`,
      { userId: user.id },
    );
    expect(status).toBe(202);
    expect(json.message).toBe('Retry started');
    const data = json.data as { submission: { id: string; status: string } };
    expect(data.submission.id).toBe(existing.id);
    expect(data.submission.status).toBe('awaiting_ci');
    expect(await prisma.submission.count({ where: { ticketId } })).toBe(1);
  });

  it('ownership — other user gets 404 on poll', async () => {
    const owner = await seedReadyUser();
    const other = await seedReadyUser();
    const ticketId = await startInProgressTicket(owner.id);
    await api('POST', `/tickets/${ticketId}/submissions`, { userId: owner.id });

    const { status, json } = await api('GET', `/tickets/${ticketId}/submissions/1`, {
      userId: other.id,
    });
    expect(status).toBe(404);
    expect(json.message).toBe('Submission not found');
  });
});
