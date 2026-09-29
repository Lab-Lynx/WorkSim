import 'dotenv/config';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SubscriptionStatus,
  StarterTemplate,
  TicketStatus,
  type PrismaClient,
} from '@prisma/client';
import type { Express } from 'express';

/**
 * Doc 9 §9.3.13 endpoint-gates.integration.test.ts
 *
 * Table-driven test covering every route (EP-01 to EP-34).
 * Expected status when the named precondition is missing (— means not applicable).
 *
 * | Endpoint                                          | No session                         | No paid access | GitHub not connected | No starter repo | Other user's resource |
 * | ------------------------------------------------- | ---------------------------------- | -------------- | -------------------- | --------------- | --------------------- |
 * | EP-01, EP-02, EP-06, EP-07, EP-08, EP-09 (public) | —                                  | —              | —                    | —               | —                     |
 * | EP-03                                             | 401 (no or invalid refresh cookie) | —              | —                    | —               | —                     |
 * | EP-04, EP-05, EP-10, EP-11, EP-12                 | 401                                | —              | —                    | —               | —                     |
 * | EP-13, EP-15, EP-16, EP-17                        | 401                                | —              | —                    | —               | —                     |
 * | EP-14, EP-33 (webhooks)                           | — (bad signature: 401)             | —              | —                    | —               | —                     |
 * | EP-18                                             | 401                                | 402            | —                    | —               | —                     |
 * | EP-19, EP-20, EP-21                               | 401                                | —              | —                    | —               | —                     |
 * | EP-22                                             | 401                                | 402            | 403                  | —               | —                     |
 * | EP-23                                             | 401                                | 402            | 403                  | 409             | —                     |
 * | EP-24, EP-34                                      | 401                                | —              | —                    | —               | —                     |
 * | EP-25, EP-29, EP-31                               | 401                                | —              | —                    | —               | 404                   |
 * | EP-26, EP-28, EP-32                               | 401                                | 402            | —                    | —               | 404                   |
 * | EP-27, EP-30                                      | 401                                | 402            | 403                  | 409             | 404                   |
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

vi.mock('../../src/integrations/github.js', () => ({
  createBranch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/integrations/gemini.js', () => ({
  generateTicketWording: vi.fn().mockResolvedValue({
    title: 'Test ticket',
    scenario: 'Test scenario',
    category: 'frontend',
    difficulty: 'beginner',
    touchedFiles: ['src/App.tsx'],
    acceptanceCriteria: ['Pass'],
    testChecklist: ['Verify'],
  }),
  callMentorModel: vi.fn().mockResolvedValue('Mocked mentor guidance'),
  generateMentorReply: vi.fn().mockResolvedValue('Mocked mentor guidance'),
}));

vi.mock('../../src/integrations/groq.js', () => ({
  evaluateSubmission: vi.fn().mockResolvedValue({
    feedback: 'Mocked evaluation feedback',
    requirementsMetScore: 40,
    correctnessTestsScore: 25,
    codeQualityScore: 20,
    problemSolvingScore: 15,
  }),
}));

vi.mock('../../src/services/email.service.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

export interface EndpointSpec {
  id: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string; // e.g. '/auth/login', '/tickets/:ticketId'
  getPath: (ticketId: string) => string;
  implemented: boolean;
  unimplementedReason?: string;
  noSessionExpected?: number; // 401 or undefined for public/webhooks
  badSignatureExpected?: number; // 401 for webhooks with missing/invalid signature
  noPaidExpected?: number; // 402 or undefined
  noGitHubExpected?: number; // 403 or undefined
  noRepoExpected?: number; // 409 or undefined
  otherUserExpected?: number; // 404 or undefined
  validBody?: (ticketId: string) => unknown;
}

export const ENDPOINT_TABLE: EndpointSpec[] = [
  // EP-01 to EP-10: Auth (built & active)
  {
    id: 'EP-01',
    method: 'POST',
    path: '/auth/register',
    getPath: () => '/auth/register',
    implemented: true,
  },
  {
    id: 'EP-02',
    method: 'POST',
    path: '/auth/login',
    getPath: () => '/auth/login',
    implemented: true,
  },
  {
    id: 'EP-03',
    method: 'POST',
    path: '/auth/refresh',
    getPath: () => '/auth/refresh',
    implemented: true,
    noSessionExpected: 401,
  },
  {
    id: 'EP-04',
    method: 'POST',
    path: '/auth/logout',
    getPath: () => '/auth/logout',
    implemented: true,
    noSessionExpected: 401,
  },
  {
    id: 'EP-05',
    method: 'POST',
    path: '/auth/logout-all',
    getPath: () => '/auth/logout-all',
    implemented: true,
    noSessionExpected: 401,
  },
  {
    id: 'EP-06',
    method: 'POST',
    path: '/auth/verify-email',
    getPath: () => '/auth/verify-email',
    implemented: true,
  },
  {
    id: 'EP-07',
    method: 'POST',
    path: '/auth/resend-verification',
    getPath: () => '/auth/resend-verification',
    implemented: true,
  },
  {
    id: 'EP-08',
    method: 'POST',
    path: '/auth/forgot-password',
    getPath: () => '/auth/forgot-password',
    implemented: true,
  },
  {
    id: 'EP-09',
    method: 'POST',
    path: '/auth/reset-password',
    getPath: () => '/auth/reset-password',
    implemented: true,
  },
  {
    id: 'EP-10',
    method: 'POST',
    path: '/auth/change-password',
    getPath: () => '/auth/change-password',
    implemented: true,
    noSessionExpected: 401,
  },

  // EP-11 to EP-12: Users (built & active)
  {
    id: 'EP-11',
    method: 'GET',
    path: '/users/me',
    getPath: () => '/users/me',
    implemented: true,
    noSessionExpected: 401,
  },
  {
    id: 'EP-12',
    method: 'PATCH',
    path: '/users/me',
    getPath: () => '/users/me',
    implemented: true,
    noSessionExpected: 401,
    validBody: () => ({ displayName: 'Ada Lovelace' }),
  },

  // EP-13 to EP-17: Subscriptions and Payments (deferred/pending BE-013 to BE-017)
  // These routes will be mounted in src/routes/index.ts when their respective feature branches land.
  {
    id: 'EP-13',
    method: 'POST',
    path: '/subscriptions/checkout',
    getPath: () => '/subscriptions/checkout',
    implemented: false,
    unimplementedReason: 'Pending subscription checkout service (BE-013)',
    noSessionExpected: 401,
  },
  {
    id: 'EP-14',
    method: 'POST',
    path: '/webhooks/chapa',
    getPath: () => '/webhooks/chapa',
    implemented: false,
    unimplementedReason:
      'Pending Chapa webhook handler (BE-014); raw body parser is mounted in app.ts ahead of express.json',
    badSignatureExpected: 401,
  },
  {
    id: 'EP-15',
    method: 'GET',
    path: '/subscriptions/me',
    getPath: () => '/subscriptions/me',
    implemented: false,
    unimplementedReason: 'Pending subscription status endpoint (BE-015)',
    noSessionExpected: 401,
  },
  {
    id: 'EP-16',
    method: 'POST',
    path: '/subscriptions/cancel',
    getPath: () => '/subscriptions/cancel',
    implemented: false,
    unimplementedReason: 'Pending subscription cancellation endpoint (BE-016)',
    noSessionExpected: 401,
  },
  {
    id: 'EP-17',
    method: 'GET',
    path: '/payments',
    getPath: () => '/payments',
    implemented: false,
    unimplementedReason: 'Pending payment history endpoint (BE-017)',
    noSessionExpected: 401,
  },

  // EP-18 to EP-22: GitHub OAuth & Repos (deferred/pending branch origin/github_oauth_repo)
  // Feature branch github_oauth_repo contains routes/controllers/services pending PR merge into Dev.
  {
    id: 'EP-18',
    method: 'GET',
    path: '/github/connect',
    getPath: () => '/github/connect',
    implemented: false,
    unimplementedReason: 'Pending GitHub OAuth connect endpoint (BE-018) from github_oauth_repo branch',
    noSessionExpected: 401,
    noPaidExpected: 402,
  },
  {
    id: 'EP-19',
    method: 'GET',
    path: '/github/callback',
    getPath: () => '/github/callback',
    implemented: false,
    unimplementedReason: 'Pending GitHub OAuth callback endpoint (BE-019) from github_oauth_repo branch',
    noSessionExpected: 401,
  },
  {
    id: 'EP-20',
    method: 'GET',
    path: '/github/connection',
    getPath: () => '/github/connection',
    implemented: false,
    unimplementedReason: 'Pending GitHub connection status endpoint (BE-020) from github_oauth_repo branch',
    noSessionExpected: 401,
  },
  {
    id: 'EP-21',
    method: 'DELETE',
    path: '/github/connection',
    getPath: () => '/github/connection',
    implemented: false,
    unimplementedReason: 'Pending GitHub disconnect endpoint (BE-021) from github_oauth_repo branch',
    noSessionExpected: 401,
  },
  {
    id: 'EP-22',
    method: 'POST',
    path: '/github/repo',
    getPath: () => '/github/repo',
    implemented: false,
    unimplementedReason: 'Pending starter repo creation endpoint (BE-022) from github_oauth_repo branch',
    noSessionExpected: 401,
    noPaidExpected: 402,
    noGitHubExpected: 403,
  },

  // EP-23 to EP-27: Tickets (built & active)
  {
    id: 'EP-23',
    method: 'POST',
    path: '/tickets',
    getPath: () => '/tickets',
    implemented: true,
    noSessionExpected: 401,
    noPaidExpected: 402,
    noGitHubExpected: 403,
    noRepoExpected: 409,
  },
  {
    id: 'EP-24',
    method: 'GET',
    path: '/tickets/current',
    getPath: () => '/tickets/current',
    implemented: true,
    noSessionExpected: 401,
  },
  {
    id: 'EP-25',
    method: 'GET',
    path: '/tickets/:ticketId',
    getPath: (ticketId) => `/tickets/${ticketId}`,
    implemented: true,
    noSessionExpected: 401,
    otherUserExpected: 404,
  },
  {
    id: 'EP-26',
    method: 'POST',
    path: '/tickets/:ticketId/start',
    getPath: (ticketId) => `/tickets/${ticketId}/start`,
    implemented: true,
    noSessionExpected: 401,
    noPaidExpected: 402,
    otherUserExpected: 404,
  },
  {
    id: 'EP-27',
    method: 'POST',
    path: '/tickets/:ticketId/abandon',
    getPath: (ticketId) => `/tickets/${ticketId}/abandon`,
    implemented: true,
    noSessionExpected: 401,
    noPaidExpected: 402,
    noGitHubExpected: 403,
    noRepoExpected: 409,
    otherUserExpected: 404,
    validBody: () => ({ reason: 'Cannot reproduce issue' }),
  },

  // EP-28 to EP-29: Mentor (built & active)
  {
    id: 'EP-28',
    method: 'POST',
    path: '/tickets/:ticketId/mentor/messages',
    getPath: (ticketId) => `/tickets/${ticketId}/mentor/messages`,
    implemented: true,
    noSessionExpected: 401,
    noPaidExpected: 402,
    otherUserExpected: 404,
    validBody: () => ({ content: 'Need assistance with this ticket' }),
  },
  {
    id: 'EP-29',
    method: 'GET',
    path: '/tickets/:ticketId/mentor/messages',
    getPath: (ticketId) => `/tickets/${ticketId}/mentor/messages`,
    implemented: true,
    noSessionExpected: 401,
    otherUserExpected: 404,
  },

  // EP-30 to EP-32: Submissions (built & active)
  {
    id: 'EP-30',
    method: 'POST',
    path: '/tickets/:ticketId/submissions',
    getPath: (ticketId) => `/tickets/${ticketId}/submissions`,
    implemented: true,
    noSessionExpected: 401,
    noPaidExpected: 402,
    noGitHubExpected: 403,
    noRepoExpected: 409,
    otherUserExpected: 404,
  },
  {
    id: 'EP-31',
    method: 'GET',
    path: '/tickets/:ticketId/submissions/:attempt',
    getPath: (ticketId) => `/tickets/${ticketId}/submissions/1`,
    implemented: true,
    noSessionExpected: 401,
    otherUserExpected: 404,
  },
  {
    id: 'EP-32',
    method: 'POST',
    path: '/tickets/:ticketId/submissions/:attempt/retry',
    getPath: (ticketId) => `/tickets/${ticketId}/submissions/1/retry`,
    implemented: true,
    noSessionExpected: 401,
    noPaidExpected: 402,
    otherUserExpected: 404,
  },

  // EP-33: Webhook (deferred/pending BE-033)
  {
    id: 'EP-33',
    method: 'POST',
    path: '/webhooks/github',
    getPath: () => '/webhooks/github',
    implemented: false,
    unimplementedReason:
      'Pending GitHub Actions CI webhook (BE-033); raw body parser is mounted in app.ts ahead of express.json',
    badSignatureExpected: 401,
  },

  // EP-34: Profile (built & active)
  {
    id: 'EP-34',
    method: 'GET',
    path: '/profile',
    getPath: () => '/profile',
    implemented: true,
    noSessionExpected: 401,
  },
];

describeDb('Doc 9 §9.3.13 endpoint-gates table-driven test', () => {
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
  });

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
    let json: { statusCode?: number; success?: boolean; message?: string; data?: unknown } | null =
      null;
    try {
      json = (await res.json()) as {
        statusCode?: number;
        success?: boolean;
        message?: string;
        data?: unknown;
      };
    } catch {
      // Non-JSON or empty
    }
    return { status: res.status, json };
  }

  async function createUser(email = `${randomUUID()}@example.com`) {
    return prisma.user.create({
      data: { email, passwordHash: 'hash', role: 'user' },
    });
  }

  async function createFullyProvisionedUser() {
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
        githubLogin: 'octocat',
        accessTokenEncrypted: 'enc-token',
        scope: 'repo',
      },
    });
    await prisma.starterRepo.create({
      data: {
        userId: user.id,
        starterTemplate: StarterTemplate.react,
        githubRepoId: `repo-${user.id}`,
        fullName: 'octocat/starter',
        defaultBranch: 'main',
      },
    });
    return user;
  }

  async function createTicketForUser(userId: string, status: TicketStatus = TicketStatus.assigned) {
    return prisma.ticket.create({
      data: {
        userId,
        templateKey: 'react/react-add-button',
        status,
        content: {
          title: 'Add a button',
          scenario: 'Add a primary button',
          category: 'frontend',
          difficulty: 'beginner',
          touchedFiles: ['src/App.tsx'],
          acceptanceCriteria: ['Button renders'],
          testChecklist: ['Click works'],
        },
      },
    });
  }

  describe('Route resolution and registration under /api/v1', () => {
    for (const ep of ENDPOINT_TABLE) {
      if (!ep.implemented) {
        it.skip(`${ep.id} (${ep.method} ${ep.path}) [PENDING] ${ep.unimplementedReason}`, () => {
          // Deferred route pending merge of respective feature branch
        });
        continue;
      }

      it(`${ep.id} (${ep.method} ${ep.path}) resolves under /api/v1 and does not throw 404 Route Not Found`, async () => {
        const dummyTicketId = randomUUID();
        const subPath = ep.getPath(dummyTicketId);
        const { status, json } = await api(ep.method, subPath, {
          body: ep.validBody ? ep.validBody(dummyTicketId) : undefined,
        });

        // Exact method + path assertion: If the route is missing or misnamed,
        // Express returns 404 with "Route METHOD /path not found".
        const isRouteNotFound =
          status === 404 &&
          typeof json?.message === 'string' &&
          json.message === `Route ${ep.method} /api/v1${subPath} not found`;

        expect(
          isRouteNotFound,
          `Route ${ep.method} /api/v1${subPath} failed to resolve: Express catch-all returned "${json?.message}"`,
        ).toBe(false);
      });
    }
  });

  describe('No session gate (missing or invalid auth cookie)', () => {
    for (const ep of ENDPOINT_TABLE) {
      if (!ep.implemented) {
        it.skip(`${ep.id} (${ep.method} ${ep.path}) [PENDING] ${ep.unimplementedReason}`, () => {
          // Deferred route pending merge of respective feature branch
        });
        continue;
      }

      if (ep.noSessionExpected === 401) {
        it(`${ep.id} (${ep.method} ${ep.path}) returns 401 without session`, async () => {
          const dummyTicketId = randomUUID();
          const { status } = await api(ep.method, ep.getPath(dummyTicketId), {
            body: ep.validBody ? ep.validBody(dummyTicketId) : undefined,
          });
          expect(status).toBe(401);
        });
      } else {
        it(`${ep.id} (${ep.method} ${ep.path}) is public and does not return 401`, async () => {
          const dummyTicketId = randomUUID();
          const { status } = await api(ep.method, ep.getPath(dummyTicketId));
          expect(status).not.toBe(401);
        });
      }
    }
  });

  describe('No paid access gate (authenticated user without active subscription)', () => {
    const paidGated = ENDPOINT_TABLE.filter((e) => e.noPaidExpected === 402);

    for (const ep of paidGated) {
      if (!ep.implemented) {
        it.skip(`${ep.id} (${ep.method} ${ep.path}) [PENDING] ${ep.unimplementedReason}`, () => {
          // Deferred route pending merge of respective feature branch
        });
        continue;
      }

      it(`${ep.id} (${ep.method} ${ep.path}) returns 402 when user has no paid access`, async () => {
        const user = await createUser(); // Has no subscription
        const ticket = await createTicketForUser(user.id);
        const body = ep.validBody ? ep.validBody(ticket.id) : undefined;

        const { status } = await api(ep.method, ep.getPath(ticket.id), {
          userId: user.id,
          body,
        });
        expect(status).toBe(402);
      });
    }
  });

  describe('GitHub not connected gate (authenticated + paid, but no GitHub connection)', () => {
    const githubGated = ENDPOINT_TABLE.filter((e) => e.noGitHubExpected === 403);

    for (const ep of githubGated) {
      if (!ep.implemented) {
        it.skip(`${ep.id} (${ep.method} ${ep.path}) [PENDING] ${ep.unimplementedReason}`, () => {
          // Deferred route pending merge of respective feature branch
        });
        continue;
      }

      it(`${ep.id} (${ep.method} ${ep.path}) returns 403 when GitHub is not connected`, async () => {
        const user = await createUser();
        await prisma.subscription.create({
          data: {
            userId: user.id,
            status: SubscriptionStatus.active,
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
        // No GitHubConnection seeded
        const ticket = await createTicketForUser(user.id);
        const body = ep.validBody ? ep.validBody(ticket.id) : undefined;

        const { status } = await api(ep.method, ep.getPath(ticket.id), {
          userId: user.id,
          body,
        });
        expect(status).toBe(403);
      });
    }
  });

  describe('No starter repo gate (authenticated + paid + github, but no starter repo)', () => {
    const repoGated = ENDPOINT_TABLE.filter((e) => e.noRepoExpected === 409);

    for (const ep of repoGated) {
      if (!ep.implemented) {
        it.skip(`${ep.id} (${ep.method} ${ep.path}) [PENDING] ${ep.unimplementedReason}`, () => {
          // Deferred route pending merge of respective feature branch
        });
        continue;
      }

      it(`${ep.id} (${ep.method} ${ep.path}) returns 409 when starter repo is missing`, async () => {
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
            githubLogin: 'octocat',
            accessTokenEncrypted: 'enc-token',
            scope: 'repo',
          },
        });
        // No StarterRepo seeded
        const ticket = await createTicketForUser(user.id);
        const body = ep.validBody ? ep.validBody(ticket.id) : undefined;

        const { status } = await api(ep.method, ep.getPath(ticket.id), {
          userId: user.id,
          body,
        });
        expect(status).toBe(409);
      });
    }
  });

  describe("Other user's resource gate (ownership 404 check)", () => {
    const ownershipGated = ENDPOINT_TABLE.filter((e) => e.otherUserExpected === 404);

    for (const ep of ownershipGated) {
      if (!ep.implemented) {
        it.skip(`${ep.id} (${ep.method} ${ep.path}) [PENDING] ${ep.unimplementedReason}`, () => {
          // Deferred route pending merge of respective feature branch
        });
        continue;
      }

      it(`${ep.id} (${ep.method} ${ep.path}) returns 404 when accessing another user's ticket`, async () => {
        const userA = await createFullyProvisionedUser();
        const userB = await createFullyProvisionedUser();

        // EP-26 requires status 'assigned' to start; other endpoints operate on 'in_progress' tickets
        const ticketStatus =
          ep.id === 'EP-26' ? TicketStatus.assigned : TicketStatus.in_progress;
        const ticketOfUserA = await createTicketForUser(userA.id, ticketStatus);

        // Seed Submission and MentorMessage on User A's ticket so the resource genuinely exists
        // (passing the PR steward coverage-honesty check by verifying 404 is truly ownership-gated)
        await prisma.submission.create({
          data: {
            ticketId: ticketOfUserA.id,
            attempt: 1,
            prNumber: 42,
            headSha: '0123456789abcdef0123456789abcdef01234567',
            diff: 'diff --git a/App.tsx b/App.tsx',
            status: 'failed',
            failureReason: 'CI check failed',
          },
        });
        await prisma.mentorMessage.create({
          data: {
            ticketId: ticketOfUserA.id,
            role: 'user',
            content: 'How should I approach this issue?',
          },
        });

        // Verify resource presence: User A can successfully read their own resource
        if (ep.method === 'GET') {
          const ownerRes = await api(ep.method, ep.getPath(ticketOfUserA.id), {
            userId: userA.id,
          });
          expect(ownerRes.status).toBe(200);
        }

        const body = ep.validBody ? ep.validBody(ticketOfUserA.id) : undefined;

        // User B tries to access User A's ticket -> must be rejected with 404
        const { status } = await api(ep.method, ep.getPath(ticketOfUserA.id), {
          userId: userB.id,
          body,
        });
        expect(status).toBe(404);
      });
    }
  });
});

