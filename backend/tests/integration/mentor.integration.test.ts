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
  TicketStatus,
  MentorMessageRole,
  type PrismaClient,
} from '@prisma/client';
import type { Express } from 'express';

/**
 * Doc 9 §9.3.11 — mentor integration tests against real Postgres + Express routes.
 * Skips when DATABASE_URL is unset. Fills placeholder env keys for required values.
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

const callMentorModel = vi.fn();

vi.mock('../../src/integrations/gemini.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/integrations/gemini.js')>();
  return {
    ...actual,
    callMentorModel: (...args: unknown[]) => callMentorModel(...args),
  };
});

describeDb('mentor.integration (Doc 9 §9.3.11)', () => {
  let app: Express;
  let prisma: PrismaClient;
  let generateAccessToken: (payload: { id: string; role: string }) => string;
  let env: Record<string, unknown>;
  let server: http.Server | undefined;
  let baseUrl: string;
  let dbAvailable = false;

  beforeAll(async () => {
    ({ default: app } = await import('../../src/app.js'));
    ({ prisma } = await import('../../src/config/db.js'));
    ({ generateAccessToken } = await import('../../src/utils/jwt.js'));
    ({ env } = await import('../../src/config/env.js'));

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
    callMentorModel.mockResolvedValue('What have you tried so far?');
    env.MENTOR_MESSAGES_PER_TICKET = undefined;
    env.MENTOR_MESSAGE_WINDOW_MS = undefined;

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

  async function seedUserWithTicket(status: TicketStatus = TicketStatus.in_progress) {
    const user = await prisma.user.create({
      data: {
        email: `${randomUUID()}@example.com`,
        passwordHash: 'hash',
        role: 'user',
        subscriptions: {
          create: {
            status: SubscriptionStatus.active,
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });

    const ticket = await prisma.ticket.create({
      data: {
        userId: user.id,
        templateKey: 'fix-auth',
        status,
        content: {
          title: 'Fix auth bug',
          scenario: 'User cannot login with valid credentials',
          category: 'Bugfix',
          difficulty: 'easy',
          touchedFiles: ['src/auth.ts'],
          acceptanceCriteria: ['Valid login works'],
          testChecklist: ['Run auth tests'],
        },
        branchName: `ticket/fix-auth-${randomUUID().slice(0, 8)}`,
      },
    });

    return { user, ticket };
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

  it('Message in progress — 201; two rows stored in order (user, then mentor)', async () => {
    const { user, ticket } = await seedUserWithTicket(TicketStatus.in_progress);
    callMentorModel.mockResolvedValue('What have you tried so far?');

    const { status, json } = await api('POST', `/tickets/${ticket.id}/mentor/messages`, {
      userId: user.id,
      body: { content: 'I am stuck on login logic' },
    });

    expect(status).toBe(201);
    expect(json.message).toBe('Mentor replied');
    const data = json.data as {
      userMessage: { id: string; role: string; content: string; createdAt: string };
      mentorMessage: { id: string; role: string; content: string; createdAt: string };
    };

    expect(data.userMessage.role).toBe('user');
    expect(data.userMessage.content).toBe('I am stuck on login logic');
    expect(data.mentorMessage.role).toBe('mentor');
    expect(data.mentorMessage.content).toBe('What have you tried so far?');

    const rows = await prisma.mentorMessage.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'asc' },
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].role).toBe(MentorMessageRole.user);
    expect(rows[0].content).toBe('I am stuck on login logic');
    expect(rows[1].role).toBe(MentorMessageRole.mentor);
    expect(rows[1].content).toBe('What have you tried so far?');
    expect(rows[0].createdAt.getTime()).toBeLessThanOrEqual(rows[1].createdAt.getTime());
  });

  it('Revision phase allowed — submitted_v1 returns 201 and stores messages (D-04)', async () => {
    const { user, ticket } = await seedUserWithTicket(TicketStatus.submitted_v1);
    callMentorModel.mockResolvedValue('Review your tests for edge cases.');

    const { status, json } = await api('POST', `/tickets/${ticket.id}/mentor/messages`, {
      userId: user.id,
      body: { content: 'How should I revise my solution?' },
    });

    expect(status).toBe(201);
    expect(json.message).toBe('Mentor replied');

    const rows = await prisma.mentorMessage.findMany({
      where: { ticketId: ticket.id },
    });
    expect(rows).toHaveLength(2);
  });

  it('Gemini failure — 502; zero rows stored', async () => {
    const { user, ticket } = await seedUserWithTicket(TicketStatus.in_progress);
    callMentorModel.mockRejectedValue(new Error('AI upstream timeout'));

    const { status, json } = await api('POST', `/tickets/${ticket.id}/mentor/messages`, {
      userId: user.id,
      body: { content: 'Please help' },
    });

    expect(status).toBe(502);
    expect(json.message).toBe('The mentor is unavailable, please try again');

    const count = await prisma.mentorMessage.count({
      where: { ticketId: ticket.id },
    });
    expect(count).toBe(0);
  });

  it.each([
    TicketStatus.assigned,
    TicketStatus.resubmitted,
    TicketStatus.done,
    TicketStatus.abandoned,
  ])('Wrong state (%s) — returns 409 and calls neither Gemini nor DB inserts', async (ticketStatus) => {
    const { user, ticket } = await seedUserWithTicket(ticketStatus);

    const { status, json } = await api('POST', `/tickets/${ticket.id}/mentor/messages`, {
      userId: user.id,
      body: { content: 'Help' },
    });

    expect(status).toBe(409);
    expect(json.message).toBe(
      'The mentor is only available while the ticket is in progress or awaiting revision',
    );
    expect(callMentorModel).not.toHaveBeenCalled();

    const count = await prisma.mentorMessage.count({
      where: { ticketId: ticket.id },
    });
    expect(count).toBe(0);
  });

  it('Limit — send N+1 messages with limit N; the (N+1)th returns 429', async () => {
    const limit = 2;
    env.MENTOR_MESSAGES_PER_TICKET = limit;
    const { user, ticket } = await seedUserWithTicket(TicketStatus.in_progress);

    // Send N messages successfully
    for (let i = 1; i <= limit; i++) {
      const res = await api('POST', `/tickets/${ticket.id}/mentor/messages`, {
        userId: user.id,
        body: { content: `Question ${i}` },
      });
      expect(res.status).toBe(201);
    }

    // (N+1)th message returns 429
    const { status, json } = await api('POST', `/tickets/${ticket.id}/mentor/messages`, {
      userId: user.id,
      body: { content: 'Question over limit' },
    });

    expect(status).toBe(429);
    expect(json.message).toBe('Mentor message limit reached for this ticket');

    const userMsgCount = await prisma.mentorMessage.count({
      where: { ticketId: ticket.id, role: MentorMessageRole.user },
    });
    expect(userMsgCount).toBe(limit);
  });

  it('Limit race — N-1 messages stored; two parallel messages; total user messages never exceeds N', async () => {
    const limit = 2;
    env.MENTOR_MESSAGES_PER_TICKET = limit;
    const { user, ticket } = await seedUserWithTicket(TicketStatus.in_progress);

    // Seed N-1 = 1 user message (+ 1 mentor reply)
    await prisma.mentorMessage.createMany({
      data: [
        {
          ticketId: ticket.id,
          role: MentorMessageRole.user,
          content: 'Initial question',
          createdAt: new Date('2026-03-01T10:00:00.000Z'),
        },
        {
          ticketId: ticket.id,
          role: MentorMessageRole.mentor,
          content: 'Initial reply',
          createdAt: new Date('2026-03-01T10:00:01.000Z'),
        },
      ],
    });

    // Make Gemini call take a short moment to ensure race overlap
    callMentorModel.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve('Simulated reply'), 50)),
    );

    // Send two parallel messages
    const [res1, res2] = await Promise.all([
      api('POST', `/tickets/${ticket.id}/mentor/messages`, {
        userId: user.id,
        body: { content: 'Parallel message 1' },
      }),
      api('POST', `/tickets/${ticket.id}/mentor/messages`, {
        userId: user.id,
        body: { content: 'Parallel message 2' },
      }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 429]);

    const userMessageCount = await prisma.mentorMessage.count({
      where: { ticketId: ticket.id, role: MentorMessageRole.user },
    });
    expect(userMessageCount).toBeLessThanOrEqual(limit);
  });

  it.each([TicketStatus.done, TicketStatus.abandoned])(
    'History — %s ticket returns 200 with all messages oldest first',
    async (ticketStatus) => {
      const { user, ticket } = await seedUserWithTicket(ticketStatus);

      const d1 = new Date('2026-03-01T10:00:00.000Z');
      const d2 = new Date('2026-03-01T10:01:00.000Z');
      const d3 = new Date('2026-03-01T10:02:00.000Z');

      await prisma.mentorMessage.createMany({
        data: [
          { ticketId: ticket.id, role: MentorMessageRole.user, content: 'msg 1', createdAt: d1 },
          { ticketId: ticket.id, role: MentorMessageRole.mentor, content: 'msg 2', createdAt: d2 },
          { ticketId: ticket.id, role: MentorMessageRole.user, content: 'msg 3', createdAt: d3 },
        ],
      });

      const { status, json } = await api('GET', `/tickets/${ticket.id}/mentor/messages`, {
        userId: user.id,
      });

      expect(status).toBe(200);
      expect(json.message).toBe('Mentor history');
      const data = json.data as {
        messages: Array<{ id: string; role: string; content: string; createdAt: string }>;
      };

      expect(data.messages).toHaveLength(3);
      expect(data.messages[0].content).toBe('msg 1');
      expect(data.messages[1].content).toBe('msg 2');
      expect(data.messages[2].content).toBe('msg 3');
      expect(new Date(data.messages[0].createdAt).getTime()).toBeLessThan(
        new Date(data.messages[1].createdAt).getTime(),
      );
      expect(new Date(data.messages[1].createdAt).getTime()).toBeLessThan(
        new Date(data.messages[2].createdAt).getTime(),
      );
    },
  );

  it('Hint level ignored — body includes hintLevel/stage; stage matches transcript not body', async () => {
    const { user, ticket } = await seedUserWithTicket(TicketStatus.in_progress);

    await api('POST', `/tickets/${ticket.id}/mentor/messages`, {
      userId: user.id,
      body: {
        content: 'I need help',
        hintLevel: 99,
        stage: 'specific_suggestion',
      },
    });

    expect(callMentorModel).toHaveBeenCalledWith(
      expect.objectContaining({
        hintStage: 'ask_what_tried',
        userMessage: 'I need help',
      }),
    );
  });

  it('Ownership — user B receives 404 Ticket not found for GET and POST on user A ticket', async () => {
    const { ticket } = await seedUserWithTicket(TicketStatus.in_progress);
    const userB = await prisma.user.create({
      data: {
        email: `${randomUUID()}@example.com`,
        passwordHash: 'hash',
        role: 'user',
        subscriptions: {
          create: {
            status: SubscriptionStatus.active,
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });

    const getRes = await api('GET', `/tickets/${ticket.id}/mentor/messages`, {
      userId: userB.id,
    });
    expect(getRes.status).toBe(404);
    expect(getRes.json.message).toBe('Ticket not found');

    const postRes = await api('POST', `/tickets/${ticket.id}/mentor/messages`, {
      userId: userB.id,
      body: { content: 'Intruder message' },
    });
    expect(postRes.status).toBe(404);
    expect(postRes.json.message).toBe('Ticket not found');
  });
});
