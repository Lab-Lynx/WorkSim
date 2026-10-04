import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma, TicketStatus } from '@prisma/client';
import ApiError from '../../src/utils/ApiError.js';
import { HTTP_STATUS } from '../../src/constants/index.js';

const ticketFindMany = vi.fn();

vi.mock('../../src/config/db.js', () => ({
  prisma: {
    ticket: {
      findMany: ticketFindMany,
    },
  },
}));

const { getExperienceProfile } = await import('../../src/services/profile.service.js');

const userId = 'user-1';
const otherUserId = 'user-2';

const ticketContent = {
  title: 'Add a button',
  scenario: 'Add a primary button to the form.',
  category: 'frontend',
  difficulty: 'beginner',
  touchedFiles: ['src/App.tsx'],
  acceptanceCriteria: ['Button renders'],
  testChecklist: ['Click works'],
};

const attempt2Evaluation = {
  id: 'eval-2',
  submissionId: 'sub-2',
  feedback: 'Solid final pass.',
  requirementsMetScore: 80,
  correctnessTestsScore: 70,
  codeQualityScore: 60,
  problemSolvingScore: 90,
  totalScore: new Prisma.Decimal('74.50'),
  createdAt: new Date('2026-03-02T12:00:00.000Z'),
};

const attempt1Evaluation = {
  id: 'eval-1',
  submissionId: 'sub-1',
  feedback: 'First-pass feedback only.',
  requirementsMetScore: null,
  correctnessTestsScore: null,
  codeQualityScore: null,
  problemSolvingScore: null,
  totalScore: null,
  createdAt: new Date('2026-03-01T12:00:00.000Z'),
};

function doneTicket(overrides: {
  id: string;
  userId?: string;
  completedAt: Date;
  title?: string;
  submissions?: unknown[];
}) {
  return {
    id: overrides.id,
    userId: overrides.userId ?? userId,
    templateKey: 'fe-button',
    status: TicketStatus.done,
    content: {
      ...ticketContent,
      title: overrides.title ?? ticketContent.title,
    },
    branchName: `ticket/${overrides.id}`,
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-02T12:00:00.000Z'),
    completedAt: overrides.completedAt,
    abandonedAt: null,
    submissions:
      overrides.submissions ??
      [
        {
          id: `sub-2-${overrides.id}`,
          ticketId: overrides.id,
          attempt: 2,
          evaluation: attempt2Evaluation,
        },
      ],
  };
}

describe('profile.service (doc 9 §9.2.14)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only done tickets (excludes assigned/in_progress/submitted_v1/resubmitted/abandoned)', async () => {
    const done = doneTicket({
      id: 't-done',
      completedAt: new Date('2026-03-02T00:00:00.000Z'),
    });
    ticketFindMany.mockResolvedValue([done]);

    const items = await getExperienceProfile(userId);

    expect(ticketFindMany).toHaveBeenCalledWith({
      where: { userId, status: TicketStatus.done },
      orderBy: { completedAt: 'desc' },
      take: 100,
      include: {
        submissions: {
          where: { attempt: 2 },
          include: { evaluation: true },
        },
      },
    });
    expect(items).toHaveLength(1);
    expect(items[0].ticketId).toBe('t-done');
  });

  it('orders newest completedAt first', async () => {
    const older = doneTicket({
      id: 't-old',
      completedAt: new Date('2026-01-01T00:00:00.000Z'),
      title: 'Old',
    });
    const mid = doneTicket({
      id: 't-mid',
      completedAt: new Date('2026-02-01T00:00:00.000Z'),
      title: 'Mid',
    });
    const newest = doneTicket({
      id: 't-new',
      completedAt: new Date('2026-03-01T00:00:00.000Z'),
      title: 'New',
    });
    // Prisma returns already ordered; assert we preserve order
    ticketFindMany.mockResolvedValue([newest, mid, older]);

    const items = await getExperienceProfile(userId);

    expect(items.map((i) => i.ticketId)).toEqual(['t-new', 't-mid', 't-old']);
  });

  it('uses only the attempt-2 evaluation with scores (not attempt 1)', async () => {
    const ticket = doneTicket({
      id: 't-done',
      completedAt: new Date('2026-03-02T00:00:00.000Z'),
      submissions: [
        {
          id: 'sub-1',
          ticketId: 't-done',
          attempt: 1,
          evaluation: attempt1Evaluation,
        },
        {
          id: 'sub-2',
          ticketId: 't-done',
          attempt: 2,
          evaluation: attempt2Evaluation,
        },
      ],
    });
    // Query filters attempt: 2, so Prisma returns only attempt 2
    ticketFindMany.mockResolvedValue([
      {
        ...ticket,
        submissions: [
          {
            id: 'sub-2',
            ticketId: 't-done',
            attempt: 2,
            evaluation: attempt2Evaluation,
          },
        ],
      },
    ]);

    const items = await getExperienceProfile(userId);

    expect(items).toHaveLength(1);
    expect(items[0].evaluation.feedback).toBe('Solid final pass.');
    expect(items[0].evaluation.scores).toEqual({
      requirementsMet: 80,
      correctnessTests: 70,
      codeQuality: 60,
      problemSolving: 90,
      total: 74.5,
    });
    expect(items[0].evaluation.feedback).not.toBe(attempt1Evaluation.feedback);
  });

  it('returns the ProfileItem shape', async () => {
    const completedAt = new Date('2026-03-02T15:30:00.000Z');
    ticketFindMany.mockResolvedValue([
      doneTicket({ id: 't-done', completedAt }),
    ]);

    const items = await getExperienceProfile(userId);

    expect(items).toHaveLength(1);
    expect(Object.keys(items[0]).sort()).toEqual(
      ['category', 'completedAt', 'difficulty', 'evaluation', 'ticketId', 'title'].sort(),
    );
    expect(items[0]).toEqual({
      ticketId: 't-done',
      title: 'Add a button',
      category: 'frontend',
      difficulty: 'beginner',
      completedAt: completedAt.toISOString(),
      evaluation: {
        feedback: 'Solid final pass.',
        scores: {
          requirementsMet: 80,
          correctnessTests: 70,
          codeQuality: 60,
          problemSolving: 90,
          total: 74.5,
        },
        createdAt: attempt2Evaluation.createdAt.toISOString(),
      },
    });
  });

  it('returns [] when the user has no completed tickets', async () => {
    ticketFindMany.mockResolvedValue([]);

    await expect(getExperienceProfile(userId)).resolves.toEqual([]);
  });

  it('queries only the caller userId (own tickets only)', async () => {
    ticketFindMany.mockResolvedValue([]);

    await getExperienceProfile(userId);

    expect(ticketFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId, status: TicketStatus.done },
      }),
    );
    expect(ticketFindMany.mock.calls[0][0].where.userId).not.toBe(otherUserId);
  });

  it('throws a data-integrity error when a done ticket has no attempt-2 evaluation', async () => {
    ticketFindMany.mockResolvedValue([
      doneTicket({
        id: 't-corrupt',
        completedAt: new Date('2026-03-02T00:00:00.000Z'),
        submissions: [
          {
            id: 'sub-2',
            ticketId: 't-corrupt',
            attempt: 2,
            evaluation: null,
          },
        ],
      }),
    ]);

    await expect(getExperienceProfile(userId)).rejects.toBeInstanceOf(ApiError);
    await expect(getExperienceProfile(userId)).rejects.toMatchObject({
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      message: expect.stringMatching(/data integrity/i),
    });
  });

  it('throws a data-integrity error when attempt-2 submission is missing entirely', async () => {
    ticketFindMany.mockResolvedValue([
      doneTicket({
        id: 't-corrupt',
        completedAt: new Date('2026-03-02T00:00:00.000Z'),
        submissions: [],
      }),
    ]);

    await expect(getExperienceProfile(userId)).rejects.toMatchObject({
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      message: expect.stringMatching(/data integrity/i),
    });
  });
});
