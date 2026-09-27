import 'dotenv/config';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  Prisma,
  SubmissionStatus,
  TicketStatus,
  type PrismaClient,
} from '@prisma/client';
import type { Express } from 'express';

/**
 * EP-34 profile route — auth gate + done-ticket projection.
 * Skips when DATABASE_URL is unset (same pattern as other Doc 9 integration suites).
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

const ticketContent = {
  title: 'Add a button',
  scenario: 'Add a primary button',
  category: 'frontend',
  difficulty: 'beginner',
  touchedFiles: ['src/App.tsx'],
  acceptanceCriteria: ['Button renders'],
  testChecklist: ['Click works'],
};

describeDb('profile EP-34 (route gates + projection)', () => {
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

  function authCookie(userId: string) {
    const token = generateAccessToken({ id: userId, role: 'user' });
    return `accessToken=${token}`;
  }

  async function api(path: string, userId?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (userId) {
      headers.Cookie = authCookie(userId);
    }
    const res = await fetch(`${baseUrl}/api/v1${path}`, { method: 'GET', headers });
    const json = (await res.json()) as {
      statusCode: number;
      success: boolean;
      message: string;
      data: { items?: unknown[] } | null;
    };
    return { status: res.status, json };
  }

  it('GET /profile without session returns 401', async () => {
    const { status, json } = await api('/profile');
    expect(status).toBe(401);
    expect(json.success).toBe(false);
  });

  it('GET /profile returns only done tickets with attempt-2 scores (newest first)', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${randomUUID()}@example.com`,
        passwordHash: 'hash',
        role: 'user',
      },
    });

    const completedOld = new Date('2026-01-15T00:00:00.000Z');
    const completedNew = new Date('2026-03-01T00:00:00.000Z');

    const doneNew = await prisma.ticket.create({
      data: {
        userId: user.id,
        templateKey: 'fe-button',
        status: TicketStatus.done,
        content: { ...ticketContent, title: 'Newest done' },
        branchName: `ticket/new-${randomUUID().slice(0, 8)}`,
        completedAt: completedNew,
      },
    });
    const doneOld = await prisma.ticket.create({
      data: {
        userId: user.id,
        templateKey: 'fe-button',
        status: TicketStatus.done,
        content: { ...ticketContent, title: 'Oldest done' },
        branchName: `ticket/old-${randomUUID().slice(0, 8)}`,
        completedAt: completedOld,
      },
    });
    await prisma.ticket.create({
      data: {
        userId: user.id,
        templateKey: 'fe-button',
        status: TicketStatus.abandoned,
        content: { ...ticketContent, title: 'Abandoned' },
        branchName: `ticket/abd-${randomUUID().slice(0, 8)}`,
        abandonedAt: new Date('2026-02-01T00:00:00.000Z'),
      },
    });
    await prisma.ticket.create({
      data: {
        userId: user.id,
        templateKey: 'fe-button',
        status: TicketStatus.in_progress,
        content: { ...ticketContent, title: 'In progress' },
        branchName: `ticket/ip-${randomUUID().slice(0, 8)}`,
      },
    });

    for (const ticket of [doneNew, doneOld]) {
      const sub = await prisma.submission.create({
        data: {
          ticketId: ticket.id,
          attempt: 2,
          status: SubmissionStatus.completed,
          prNumber: 1,
          headSha: 'abc',
          diff: 'diff',
          ciPassed: true,
        },
      });
      await prisma.evaluation.create({
        data: {
          submissionId: sub.id,
          feedback: `Feedback for ${ticket.id}`,
          requirementsMetScore: 80,
          correctnessTestsScore: 70,
          codeQualityScore: 60,
          problemSolvingScore: 90,
          totalScore: new Prisma.Decimal('74.50'),
        },
      });
    }

    const { status, json } = await api('/profile', user.id);

    expect(status).toBe(200);
    expect(json.message).toBe('Profile');
    expect(json.data?.items).toHaveLength(2);
    const items = json.data!.items as Array<{
      ticketId: string;
      title: string;
      evaluation: { scores: { total: number } | null };
    }>;
    expect(items[0].ticketId).toBe(doneNew.id);
    expect(items[0].title).toBe('Newest done');
    expect(items[1].ticketId).toBe(doneOld.id);
    expect(items.map((i) => i.title)).not.toContain('Abandoned');
    expect(items.map((i) => i.title)).not.toContain('In progress');
    expect(items[0].evaluation.scores?.total).toBe(74.5);
  });

  it('GET /profile returns items: [] when user has no done tickets', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${randomUUID()}@example.com`,
        passwordHash: 'hash',
        role: 'user',
      },
    });

    const { status, json } = await api('/profile', user.id);

    expect(status).toBe(200);
    expect(json.data).toEqual({ items: [] });
  });
});
