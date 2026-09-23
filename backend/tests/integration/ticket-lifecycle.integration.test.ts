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
  type PrismaClient,
} from '@prisma/client';
import type { Express } from 'express';
import type { TicketTemplate } from '../../src/types/domain.js';

/**
 * Doc 9 §9.3.10 — ticket lifecycle over real Postgres + Express routes.
 * Skips when DATABASE_URL is unset. Fills obviously-fake placeholders for
 * other required app env keys so importing `app` does not fail when the
 * local `.env` is only partially filled for DB work.
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

vi.mock('../../src/integrations/github.js', () => ({
  createBranch: (...args: unknown[]) => createBranch(...args),
}));

vi.mock('../../src/integrations/gemini.js', () => ({
  generateTicketWording: (...args: unknown[]) => generateTicketWording(...args),
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

describeDb('ticket-lifecycle (Doc 9 §9.3.10)', () => {
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

  it('Assign — POST /tickets returns 201 with assigned ticket and creates a branch', async () => {
    const user = await seedReadyUser();

    const { status, json } = await api('POST', '/tickets', { userId: user.id });

    expect(status).toBe(201);
    expect(json.message).toBe('Ticket assigned');
    const data = json.data as { ticket: { status: string; branchName: string } };
    expect(data.ticket.status).toBe('assigned');
    expect(data.ticket.branchName).toBeTruthy();
    expect(createBranch).toHaveBeenCalledTimes(1);
    expect(createBranch.mock.calls[0][0]).toMatchObject({
      branchName: data.ticket.branchName,
      baseBranch: 'main',
    });
  });

  it('Second assign returns 409; parallel assign yields one 201 and one 409', async () => {
    const user = await seedReadyUser();
    const first = await api('POST', '/tickets', { userId: user.id });
    expect(first.status).toBe(201);

    const second = await api('POST', '/tickets', { userId: user.id });
    expect(second.status).toBe(409);
    expect(second.json.message).toBe('You already have an active ticket');

    const other = await seedReadyUser();
    const [a, b] = await Promise.all([
      api('POST', '/tickets', { userId: other.id }),
      api('POST', '/tickets', { userId: other.id }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
  });

  it('Start — first 200 in_progress, second 409', async () => {
    const user = await seedReadyUser();
    const assigned = await api('POST', '/tickets', { userId: user.id });
    const ticketId = (assigned.json.data as { ticket: { id: string } }).ticket.id;

    const first = await api('POST', `/tickets/${ticketId}/start`, {
      userId: user.id,
    });
    expect(first.status).toBe(200);
    expect(
      (first.json.data as { ticket: { status: string } }).ticket.status,
    ).toBe('in_progress');

    const second = await api('POST', `/tickets/${ticketId}/start`, {
      userId: user.id,
    });
    expect(second.status).toBe(409);
    expect(second.json.message).toBe('This ticket has already been started');
  });

  it('Abandon before submission — abandons and assigns a replacement', async () => {
    const user = await seedReadyUser();
    const assigned = await api('POST', '/tickets', { userId: user.id });
    const ticketId = (assigned.json.data as { ticket: { id: string } }).ticket.id;

    const abandoned = await api('POST', `/tickets/${ticketId}/abandon`, {
      userId: user.id,
    });
    expect(abandoned.status).toBe(200);
    const data = abandoned.json.data as {
      abandonedTicketId: string;
      newTicket: { id: string; status: string } | null;
    };
    expect(data.abandonedTicketId).toBe(ticketId);
    expect(data.newTicket?.status).toBe('assigned');

    const old = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    expect(old.status).toBe(TicketStatus.abandoned);
    expect(old.abandonedAt).not.toBeNull();
  });

  it('Abandon after submission returns 409', async () => {
    const user = await seedReadyUser();
    const assigned = await api('POST', '/tickets', { userId: user.id });
    const ticketId = (assigned.json.data as { ticket: { id: string } }).ticket.id;
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.submitted_v1 },
    });

    const res = await api('POST', `/tickets/${ticketId}/abandon`, {
      userId: user.id,
    });
    expect(res.status).toBe(409);
    expect(res.json.message).toBe(
      'A ticket cannot be abandoned after it has been submitted',
    );
  });

  it('Generation failure returns 502 with no ticket row and no branch', async () => {
    const user = await seedReadyUser();
    generateTicketWording.mockRejectedValue(new Error('gemini down'));

    const res = await api('POST', '/tickets', { userId: user.id });
    expect(res.status).toBe(502);
    expect(res.json.message).toBe('Could not generate a ticket, please try again');
    expect(createBranch).not.toHaveBeenCalled();
    expect(await prisma.ticket.count({ where: { userId: user.id } })).toBe(0);
  });

  it('Branch failure returns 502 with no ticket row', async () => {
    const user = await seedReadyUser();
    createBranch.mockRejectedValue(new Error('github down'));

    const res = await api('POST', '/tickets', { userId: user.id });
    expect(res.status).toBe(502);
    expect(res.json.message).toBe(
      'Could not create the ticket branch on GitHub, please try again',
    );
    expect(await prisma.ticket.count({ where: { userId: user.id } })).toBe(0);
  });

  it('Ownership — other user gets 404 on get/start/abandon', async () => {
    const owner = await seedReadyUser();
    const other = await seedReadyUser();
    const assigned = await api('POST', '/tickets', { userId: owner.id });
    const ticketId = (assigned.json.data as { ticket: { id: string } }).ticket.id;
    const randomId = randomUUID();

    for (const path of [
      `/tickets/${ticketId}`,
      `/tickets/${ticketId}/start`,
      `/tickets/${ticketId}/abandon`,
    ]) {
      const method = path.endsWith(ticketId) ? 'GET' : 'POST';
      const owned = await api(method, path.replace(ticketId, randomId), {
        userId: other.id,
      });
      const foreign = await api(method, path, { userId: other.id });
      expect(foreign.status).toBe(404);
      expect(foreign.json.message).toBe('Ticket not found');
      expect(foreign.json.message).toBe(owned.json.message);
    }
  });

  it('Gate order — 402 then 403 then 409', async () => {
    const user = await createUser();

    const noSub = await api('POST', '/tickets', { userId: user.id });
    expect(noSub.status).toBe(402);

    await prisma.subscription.create({
      data: {
        userId: user.id,
        status: SubscriptionStatus.active,
        currentPeriodEnd: new Date(Date.now() + 86400000),
      },
    });
    const noGh = await api('POST', '/tickets', { userId: user.id });
    expect(noGh.status).toBe(403);

    await prisma.gitHubConnection.create({
      data: {
        userId: user.id,
        githubUserId: `gh-${user.id}`,
        githubLogin: 'ada',
        accessTokenEncrypted: 'enc',
        scope: 'repo',
      },
    });
    const noRepo = await api('POST', '/tickets', { userId: user.id });
    expect(noRepo.status).toBe(409);
    expect(noRepo.json.message).toBe(
      'Create your starter repository before requesting a ticket',
    );
  });
});
