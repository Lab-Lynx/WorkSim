import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  PaymentStatus,
  Prisma,
  PrismaClient,
  StarterTemplate,
  SubmissionStatus,
  SubscriptionStatus,
  TicketStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * Doc 9 §9.3.7 — proves hand-written SQL (DR-01–DR-04) and related DB rules.
 * Needs a migrated Postgres. Skips when DATABASE_URL is unset (CI gap D-33).
 */

const databaseUrl = process.env.DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

function createPrisma(): PrismaClient {
  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

async function isConstraintRejection(promise: Promise<unknown>): Promise<boolean> {
  try {
    await promise;
    return false;
  } catch (err) {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError ||
      (err instanceof Error &&
        (/unique|check|restrict|foreign key|invalid input value/i.test(err.message) ||
          'code' in err))
    );
  }
}

describeDb('db-constraints (Doc 9 §9.3.7)', () => {
  const prisma = createPrisma();

  beforeEach(async () => {
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
    await prisma.$disconnect();
  });

  async function createUser(email = `${randomUUID()}@example.com`) {
    return prisma.user.create({
      data: {
        email,
        passwordHash: 'hash',
      },
    });
  }

  async function createTicket(
    userId: string,
    overrides: {
      status?: TicketStatus;
      branchName?: string | null;
    } = {},
  ) {
    return prisma.ticket.create({
      data: {
        userId,
        templateKey: 'sample',
        status: overrides.status ?? TicketStatus.assigned,
        content: { title: 't' },
        branchName: overrides.branchName === undefined ? `branch-${randomUUID()}` : overrides.branchName,
      },
    });
  }

  async function createSubmission(
    ticketId: string,
    attempt: number,
    overrides: { status?: SubmissionStatus } = {},
  ) {
    return prisma.submission.create({
      data: {
        ticketId,
        attempt,
        status: overrides.status ?? SubmissionStatus.completed,
        prNumber: 1,
        headSha: 'abc123',
        diff: 'diff',
      },
    });
  }

  it('DR-01: rejects a second active ticket for the same user', async () => {
    const user = await createUser();
    await createTicket(user.id, { status: TicketStatus.in_progress });

    await expect(
      createTicket(user.id, { status: TicketStatus.assigned }),
    ).rejects.toBeTruthy();
  });

  it('DR-01: allows done and abandoned tickets alongside an active one', async () => {
    const user = await createUser();
    await createTicket(user.id, { status: TicketStatus.in_progress });

    await expect(
      createTicket(user.id, { status: TicketStatus.done }),
    ).resolves.toBeTruthy();
    await expect(
      createTicket(user.id, { status: TicketStatus.abandoned }),
    ).resolves.toBeTruthy();
  });

  it('DR-02: rejects a second active or past_due subscription for the same user', async () => {
    const user = await createUser();
    const periodEnd = new Date(Date.now() + 86_400_000);

    await prisma.subscription.create({
      data: {
        userId: user.id,
        status: SubscriptionStatus.active,
        currentPeriodEnd: periodEnd,
      },
    });

    await expect(
      prisma.subscription.create({
        data: {
          userId: user.id,
          status: SubscriptionStatus.active,
          currentPeriodEnd: periodEnd,
        },
      }),
    ).rejects.toBeTruthy();

    await expect(
      prisma.subscription.create({
        data: {
          userId: user.id,
          status: SubscriptionStatus.past_due,
          currentPeriodEnd: periodEnd,
        },
      }),
    ).rejects.toBeTruthy();
  });

  it('DR-02: allows an active subscription when existing ones are canceled', async () => {
    const user = await createUser();
    const periodEnd = new Date(Date.now() + 86_400_000);

    await prisma.subscription.create({
      data: {
        userId: user.id,
        status: SubscriptionStatus.canceled,
        currentPeriodEnd: periodEnd,
        canceledAt: new Date(),
      },
    });

    await expect(
      prisma.subscription.create({
        data: {
          userId: user.id,
          status: SubscriptionStatus.active,
          currentPeriodEnd: periodEnd,
        },
      }),
    ).resolves.toBeTruthy();
  });

  it('DR-03: rejects a duplicate attempt for the same ticket', async () => {
    const user = await createUser();
    const ticket = await createTicket(user.id, { status: TicketStatus.in_progress });
    await createSubmission(ticket.id, 1);

    await expect(createSubmission(ticket.id, 1)).rejects.toBeTruthy();
  });

  it('DR-03: rejects attempts outside 1 and 2', async () => {
    const user = await createUser();
    const ticket = await createTicket(user.id, { status: TicketStatus.in_progress });

    expect(await isConstraintRejection(createSubmission(ticket.id, 0))).toBe(true);
    expect(await isConstraintRejection(createSubmission(ticket.id, 3))).toBe(true);
  });

  it('DR-04: rejects evaluations with only some scores set', async () => {
    const user = await createUser();
    const ticket = await createTicket(user.id, { status: TicketStatus.resubmitted });
    const submission = await createSubmission(ticket.id, 2);

    expect(
      await isConstraintRejection(
        prisma.evaluation.create({
          data: {
            submissionId: submission.id,
            feedback: 'partial',
            requirementsMetScore: 80,
            correctnessTestsScore: null,
            codeQualityScore: null,
            problemSolvingScore: null,
            totalScore: null,
          },
        }),
      ),
    ).toBe(true);
  });

  async function submissionForScoring() {
    const user = await createUser();
    const ticket = await createTicket(user.id, { status: TicketStatus.resubmitted });
    const submission = await createSubmission(ticket.id, 2);
    return submission;
  }

  it('DR-04: rejects out-of-range category and total scores', async () => {
    const sub101 = await submissionForScoring();
    expect(
      await isConstraintRejection(
        prisma.evaluation.create({
          data: {
            submissionId: sub101.id,
            feedback: 'too high',
            requirementsMetScore: 101,
            correctnessTestsScore: 50,
            codeQualityScore: 50,
            problemSolvingScore: 50,
            totalScore: 50,
          },
        }),
      ),
    ).toBe(true);

    const subNeg = await submissionForScoring();
    expect(
      await isConstraintRejection(
        prisma.evaluation.create({
          data: {
            submissionId: subNeg.id,
            feedback: 'too low',
            requirementsMetScore: -1,
            correctnessTestsScore: 50,
            codeQualityScore: 50,
            problemSolvingScore: 50,
            totalScore: 50,
          },
        }),
      ),
    ).toBe(true);

    const subTotal = await submissionForScoring();
    expect(
      await isConstraintRejection(
        prisma.evaluation.create({
          data: {
            submissionId: subTotal.id,
            feedback: 'total too high',
            requirementsMetScore: 50,
            correctnessTestsScore: 50,
            codeQualityScore: 50,
            problemSolvingScore: 50,
            totalScore: new Prisma.Decimal('100.01'),
          },
        }),
      ),
    ).toBe(true);
  });

  it('DR-04: accepts all-null scores and all valid scores', async () => {
    const user = await createUser();
    const ticket1 = await createTicket(user.id, { status: TicketStatus.submitted_v1 });
    const sub1 = await createSubmission(ticket1.id, 1);

    await expect(
      prisma.evaluation.create({
        data: {
          submissionId: sub1.id,
          feedback: 'pass 1 feedback only',
        },
      }),
    ).resolves.toBeTruthy();

    await prisma.ticket.update({
      where: { id: ticket1.id },
      data: { status: TicketStatus.done, completedAt: new Date() },
    });

    const ticket2 = await createTicket(user.id, { status: TicketStatus.resubmitted });
    const sub2 = await createSubmission(ticket2.id, 2);

    await expect(
      prisma.evaluation.create({
        data: {
          submissionId: sub2.id,
          feedback: 'scored',
          requirementsMetScore: 80,
          correctnessTestsScore: 70,
          codeQualityScore: 60,
          problemSolvingScore: 90,
          totalScore: new Prisma.Decimal('74.50'),
        },
      }),
    ).resolves.toBeTruthy();
  });

  it('rejects a second evaluation for the same submission', async () => {
    const user = await createUser();
    const ticket = await createTicket(user.id, { status: TicketStatus.submitted_v1 });
    const submission = await createSubmission(ticket.id, 1);

    await prisma.evaluation.create({
      data: {
        submissionId: submission.id,
        feedback: 'first',
      },
    });

    await expect(
      prisma.evaluation.create({
        data: {
          submissionId: submission.id,
          feedback: 'second',
        },
      }),
    ).rejects.toBeTruthy();
  });

  it('rejects duplicate unique columns', async () => {
    const email = `${randomUUID()}@example.com`;
    const user = await createUser(email);

    await expect(createUser(email)).rejects.toBeTruthy();

    const txRef = `tx-${randomUUID()}`;
    await prisma.payment.create({
      data: {
        userId: user.id,
        chapaTxRef: txRef,
        amount: new Prisma.Decimal('10.00'),
        currency: 'ETB',
        status: PaymentStatus.pending,
      },
    });
    await expect(
      prisma.payment.create({
        data: {
          userId: user.id,
          chapaTxRef: txRef,
          amount: new Prisma.Decimal('10.00'),
          currency: 'ETB',
          status: PaymentStatus.pending,
        },
      }),
    ).rejects.toBeTruthy();

    await prisma.gitHubConnection.create({
      data: {
        userId: user.id,
        githubUserId: '1',
        githubLogin: 'alice',
        accessTokenEncrypted: 'enc',
        scope: 'repo',
      },
    });
    await expect(
      prisma.gitHubConnection.create({
        data: {
          userId: user.id,
          githubUserId: '2',
          githubLogin: 'bob',
          accessTokenEncrypted: 'enc2',
          scope: 'repo',
        },
      }),
    ).rejects.toBeTruthy();

    const repoId = `repo-${randomUUID()}`;
    await prisma.starterRepo.create({
      data: {
        userId: user.id,
        starterTemplate: StarterTemplate.react,
        githubRepoId: repoId,
        fullName: 'alice/app',
        defaultBranch: 'main',
      },
    });
    await expect(
      prisma.starterRepo.create({
        data: {
          userId: user.id,
          starterTemplate: StarterTemplate.django,
          githubRepoId: `other-${randomUUID()}`,
          fullName: 'alice/other',
          defaultBranch: 'main',
        },
      }),
    ).rejects.toBeTruthy();

    const otherUser = await createUser();
    await expect(
      prisma.starterRepo.create({
        data: {
          userId: otherUser.id,
          starterTemplate: StarterTemplate.node_express,
          githubRepoId: repoId,
          fullName: 'other/app',
          defaultBranch: 'main',
        },
      }),
    ).rejects.toBeTruthy();
  });

  it('DR-09: rejects duplicate branch names but allows multiple nulls', async () => {
    const user = await createUser();
    const branch = `feature/${randomUUID()}`;

    await createTicket(user.id, { status: TicketStatus.done, branchName: branch });

    await expect(
      createTicket(user.id, { status: TicketStatus.abandoned, branchName: branch }),
    ).rejects.toBeTruthy();

    await expect(
      createTicket(user.id, { status: TicketStatus.done, branchName: null }),
    ).resolves.toBeTruthy();
    await expect(
      createTicket(user.id, { status: TicketStatus.abandoned, branchName: null }),
    ).resolves.toBeTruthy();
  });

  it('DR-08: rejects deleting a user that still has a ticket (Restrict)', async () => {
    const user = await createUser();
    await createTicket(user.id, { status: TicketStatus.assigned });

    await expect(prisma.user.delete({ where: { id: user.id } })).rejects.toBeTruthy();
  });

  it('rejects ticket status scored; TicketStatus has exactly six values', async () => {
    const user = await createUser();
    const id = randomUUID();

    expect(
      await isConstraintRejection(
        prisma.$executeRawUnsafe(
          `INSERT INTO "Ticket" ("id", "userId", "templateKey", "status", "content", "updatedAt")
           VALUES ($1, $2, 'sample', 'scored', '{}'::jsonb, NOW())`,
          id,
          user.id,
        ),
      ),
    ).toBe(true);

    const values = Object.values(TicketStatus).sort();
    expect(values).toEqual(
      ['abandoned', 'assigned', 'done', 'in_progress', 'resubmitted', 'submitted_v1'].sort(),
    );
  });
});
