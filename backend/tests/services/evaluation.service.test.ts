import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MentorMessageRole,
  Prisma,
  type Evaluation,
  type MentorMessage,
  type Submission,
  type Ticket,
} from '@prisma/client';
import {
  GroqMalformedResponseError,
  GroqOutageError,
  GroqTimeoutError,
} from '../../src/integrations/groq.js';
import type { TicketContent } from '../../src/types/domain.js';

const submissionFindUnique = vi.fn();
const mentorMessageFindMany = vi.fn();
const evaluationCreate = vi.fn();
const evaluationFindUnique = vi.fn();

vi.mock('../../src/config/db.js', () => ({
  prisma: {
    submission: {
      findUnique: (...args: unknown[]) => submissionFindUnique(...args),
    },
    mentorMessage: {
      findMany: (...args: unknown[]) => mentorMessageFindMany(...args),
    },
    evaluation: {
      create: (...args: unknown[]) => evaluationCreate(...args),
      findUnique: (...args: unknown[]) => evaluationFindUnique(...args),
    },
  },
}));

const callEvaluatorModel = vi.fn();
vi.mock('../../src/integrations/groq.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/integrations/groq.js')>();
  return {
    ...actual,
    callEvaluatorModel: (...args: unknown[]) => callEvaluatorModel(...args),
  };
});

const {
  buildEvaluationInput,
  evaluateSubmission,
  calculateWeightedScore,
} = await import('../../src/services/evaluation.service.js');

describe('evaluation.service (Doc 8 §8.10, Doc 9 §9.2.12)', () => {
  const mockTicketContent: TicketContent = {
    title: 'Fix race condition in ticket cache',
    scenario: 'Cache invalidation is triggered concurrently without lock.',
    category: 'backend',
    difficulty: 'medium',
    touchedFiles: ['src/services/cache.ts', 'src/services/ticket.ts'],
    acceptanceCriteria: [
      'Cache mutations acquire mutex lock',
      'No stale reads under concurrent load',
    ],
    testChecklist: [
      'Run concurrent cache test suite',
      'Verify lock release on failure',
    ],
  };

  const sampleTicket: Ticket = {
    id: 'ticket-1',
    userId: 'user-1',
    templateKey: 'cache-mutex',
    status: 'in_progress',
    content: mockTicketContent as unknown as Prisma.JsonValue,
    branchName: 'ticket/cache-mutex',
    createdAt: new Date('2026-09-25T10:00:00Z'),
    updatedAt: new Date('2026-09-25T10:00:00Z'),
    completedAt: null,
    abandonedAt: null,
  };

  const sampleSubmissionAttempt1: Submission = {
    id: 'submission-1',
    ticketId: 'ticket-1',
    attempt: 1,
    status: 'evaluating',
    prNumber: 42,
    headSha: 'abc1234',
    diff: 'diff --git a/cache.ts b/cache.ts\n+ lock();',
    ciPassed: true,
    ciRunUrl: 'https://github.com/test/repo/actions/runs/101',
    failureReason: null,
    submittedAt: new Date('2026-09-25T11:00:00Z'),
    updatedAt: new Date('2026-09-25T11:00:00Z'),
  };

  const sampleSubmissionAttempt2: Submission = {
    ...sampleSubmissionAttempt1,
    id: 'submission-2',
    attempt: 2,
    diff: 'diff --git a/cache.ts b/cache.ts\n+ lock();\n+ release();',
  };

  const sampleTranscript: MentorMessage[] = [
    {
      id: 'msg-1',
      ticketId: 'ticket-1',
      role: MentorMessageRole.user,
      content: 'How should I handle lock contention?',
      createdAt: new Date('2026-09-25T10:10:00Z'),
    },
    {
      id: 'msg-2',
      ticketId: 'ticket-1',
      role: MentorMessageRole.mentor,
      content: 'Consider using a redis lock with exponential backoff.',
      createdAt: new Date('2026-09-25T10:11:00Z'),
    },
    {
      id: 'msg-3',
      ticketId: 'ticket-1',
      role: MentorMessageRole.user,
      content: 'Got it, implemented backoff.',
      createdAt: new Date('2026-09-25T10:15:00Z'),
    },
    {
      id: 'msg-4',
      ticketId: 'ticket-1',
      role: MentorMessageRole.mentor,
      content: 'Looks good, make sure to add a timeout safeguard.',
      createdAt: new Date('2026-09-25T10:16:00Z'),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildEvaluationInput', () => {
    it('attempt 1: includes diff, CI result, and ticket content; omits transcript (Doc 9 §9.2.12)', () => {
      const input = buildEvaluationInput(
        sampleSubmissionAttempt1,
        sampleTicket,
        sampleTranscript,
      );

      expect(input.attempt).toBe(1);
      expect(input.diff).toBe(sampleSubmissionAttempt1.diff);
      expect(input.ciPassed).toBe(true);
      expect(input.ticketContent).toEqual(mockTicketContent);
      expect(input.transcript).toBeUndefined();
    });

    it('attempt 2: includes diff, CI result, ticket content, and transcript in order (Doc 9 §9.2.12)', () => {
      const input = buildEvaluationInput(
        sampleSubmissionAttempt2,
        sampleTicket,
        sampleTranscript,
      );

      expect(input.attempt).toBe(2);
      expect(input.diff).toBe(sampleSubmissionAttempt2.diff);
      expect(input.ciPassed).toBe(true);
      expect(input.ticketContent).toEqual(mockTicketContent);
      expect(input.transcript).toEqual([
        { role: 'user', content: 'How should I handle lock contention?' },
        { role: 'mentor', content: 'Consider using a redis lock with exponential backoff.' },
        { role: 'user', content: 'Got it, implemented backoff.' },
        { role: 'mentor', content: 'Looks good, make sure to add a timeout safeguard.' },
      ]);
    });

    it('missing CI result: throws because evaluator never receives diff alone (Doc 9 §9.2.12)', () => {
      const submissionMissingCi = {
        ...sampleSubmissionAttempt1,
        ciPassed: null,
      };

      expect(() =>
        buildEvaluationInput(submissionMissingCi, sampleTicket, sampleTranscript),
      ).toThrow();
    });

    it('malformed ticket content: content missing acceptanceCriteria throws (Doc 9 §9.2.12)', () => {
      const malformedTicket: Ticket = {
        ...sampleTicket,
        content: {
          title: 'Title',
          scenario: 'Scenario',
          category: 'backend',
          difficulty: 'medium',
          touchedFiles: ['src/file.ts'],
          testChecklist: ['check 1'],
        } as unknown as Prisma.JsonValue,
      };

      expect(() =>
        buildEvaluationInput(sampleSubmissionAttempt1, malformedTicket),
      ).toThrow();
    });

    it('malformed ticket content: non-object content throws', () => {
      const malformedTicket: Ticket = {
        ...sampleTicket,
        content: 'not an object' as unknown as Prisma.JsonValue,
      };

      expect(() =>
        buildEvaluationInput(sampleSubmissionAttempt1, malformedTicket),
      ).toThrow();
    });
  });

  describe('evaluateSubmission', () => {
    it('attempt 1: feedback required, all score fields and total are null even if model returned scores; calculateWeightedScore not called (Doc 9 §9.2.12)', async () => {
      submissionFindUnique.mockResolvedValue({
        ...sampleSubmissionAttempt1,
        ticket: sampleTicket,
      });

      // Model returns feedback AND scores on attempt 1
      callEvaluatorModel.mockResolvedValue({
        feedback: 'Good progress on attempt 1. Ensure lock release on exception.',
        scores: {
          requirementsMet: 85,
          correctnessTests: 90,
          codeQuality: 80,
          problemSolving: 75,
        },
      });

      const fakeCreatedEvaluation: Evaluation = {
        id: 'eval-1',
        submissionId: sampleSubmissionAttempt1.id,
        feedback: 'Good progress on attempt 1. Ensure lock release on exception.',
        requirementsMetScore: null,
        correctnessTestsScore: null,
        codeQualityScore: null,
        problemSolvingScore: null,
        totalScore: null,
        createdAt: new Date('2026-09-25T11:05:00Z'),
      };
      evaluationCreate.mockResolvedValue(fakeCreatedEvaluation);

      const result = await evaluateSubmission(sampleSubmissionAttempt1.id);

      expect(callEvaluatorModel).toHaveBeenCalledTimes(1);
      expect(evaluationCreate).toHaveBeenCalledTimes(1);
      expect(evaluationCreate).toHaveBeenCalledWith({
        data: {
          submissionId: sampleSubmissionAttempt1.id,
          feedback: 'Good progress on attempt 1. Ensure lock release on exception.',
          requirementsMetScore: null,
          correctnessTestsScore: null,
          codeQualityScore: null,
          problemSolvingScore: null,
          totalScore: null,
        },
      });

      expect(result.feedback).toBe('Good progress on attempt 1. Ensure lock release on exception.');
      expect(result.requirementsMetScore).toBeNull();
      expect(result.correctnessTestsScore).toBeNull();
      expect(result.codeQualityScore).toBeNull();
      expect(result.problemSolvingScore).toBeNull();
      expect(result.totalScore).toBeNull();
    });

    it('attempt 2: feedback and four valid scores saved with totalScore = weighted total (Doc 9 §9.2.12)', async () => {
      submissionFindUnique.mockResolvedValue({
        ...sampleSubmissionAttempt2,
        ticket: sampleTicket,
      });

      mentorMessageFindMany.mockResolvedValue(sampleTranscript);

      // Category scores: 80 (40%), 60 (25%), 70 (20%), 90 (15%) -> 32 + 15 + 14 + 13.5 = 74.5
      callEvaluatorModel.mockResolvedValue({
        feedback: 'Excellent final implementation with proper lock cleanup.',
        scores: {
          requirementsMet: 80,
          correctnessTests: 60,
          codeQuality: 70,
          problemSolving: 90,
        },
      });

      const fakeCreatedEvaluation: Evaluation = {
        id: 'eval-2',
        submissionId: sampleSubmissionAttempt2.id,
        feedback: 'Excellent final implementation with proper lock cleanup.',
        requirementsMetScore: 80,
        correctnessTestsScore: 60,
        codeQualityScore: 70,
        problemSolvingScore: 90,
        totalScore: new Prisma.Decimal('74.50'),
        createdAt: new Date('2026-09-25T11:35:00Z'),
      };
      evaluationCreate.mockResolvedValue(fakeCreatedEvaluation);

      const result = await evaluateSubmission(sampleSubmissionAttempt2.id);

      expect(callEvaluatorModel).toHaveBeenCalledTimes(1);
      expect(mentorMessageFindMany).toHaveBeenCalledWith({
        where: { ticketId: sampleTicket.id },
        orderBy: { createdAt: 'asc' },
      });

      expect(evaluationCreate).toHaveBeenCalledTimes(1);
      const createArgs = evaluationCreate.mock.calls[0][0];
      expect(createArgs.data.submissionId).toBe(sampleSubmissionAttempt2.id);
      expect(createArgs.data.feedback).toBe('Excellent final implementation with proper lock cleanup.');
      expect(createArgs.data.requirementsMetScore).toBe(80);
      expect(createArgs.data.correctnessTestsScore).toBe(60);
      expect(createArgs.data.codeQualityScore).toBe(70);
      expect(createArgs.data.problemSolvingScore).toBe(90);
      expect(Number(createArgs.data.totalScore)).toBeCloseTo(74.5, 2);

      expect(result.requirementsMetScore).toBe(80);
      expect(result.correctnessTestsScore).toBe(60);
      expect(result.codeQualityScore).toBe(70);
      expect(result.problemSolvingScore).toBe(90);
      expect(Number(result.totalScore)).toBe(74.5);
    });

    it('missing category: Groq output lacks codeQuality throws and saves no Evaluation (Doc 9 §9.2.12)', async () => {
      submissionFindUnique.mockResolvedValue({
        ...sampleSubmissionAttempt2,
        ticket: sampleTicket,
      });
      mentorMessageFindMany.mockResolvedValue(sampleTranscript);

      callEvaluatorModel.mockResolvedValue({
        feedback: 'Missing codeQuality category in scores',
        scores: {
          requirementsMet: 80,
          correctnessTests: 90,
          problemSolving: 75,
        },
      });

      await expect(evaluateSubmission(sampleSubmissionAttempt2.id)).rejects.toThrow();
      expect(evaluationCreate).not.toHaveBeenCalled();
    });

    it.each([
      [101, 'score > 100'],
      [-1, 'score < 0'],
    ])('out-of-range score: %i (%s) throws and saves no Evaluation (Doc 9 §9.2.12)', async (invalidScore, _label) => {
      submissionFindUnique.mockResolvedValue({
        ...sampleSubmissionAttempt2,
        ticket: sampleTicket,
      });
      mentorMessageFindMany.mockResolvedValue(sampleTranscript);

      callEvaluatorModel.mockResolvedValue({
        feedback: 'Out of range score returned',
        scores: {
          requirementsMet: invalidScore,
          correctnessTests: 80,
          codeQuality: 80,
          problemSolving: 80,
        },
      });

      await expect(evaluateSubmission(sampleSubmissionAttempt2.id)).rejects.toThrow();
      expect(evaluationCreate).not.toHaveBeenCalled();
    });

    it.each([
      ['high', 'string value'],
      [Number.NaN, 'NaN value'],
    ])('non-numeric score: %s throws and saves no Evaluation (Doc 9 §9.2.12)', async (nonNumericScore, _label) => {
      submissionFindUnique.mockResolvedValue({
        ...sampleSubmissionAttempt2,
        ticket: sampleTicket,
      });
      mentorMessageFindMany.mockResolvedValue(sampleTranscript);

      callEvaluatorModel.mockResolvedValue({
        feedback: 'Non numeric score returned',
        scores: {
          requirementsMet: nonNumericScore,
          correctnessTests: 80,
          codeQuality: 80,
          problemSolving: 80,
        },
      });

      await expect(evaluateSubmission(sampleSubmissionAttempt2.id)).rejects.toThrow();
      expect(evaluationCreate).not.toHaveBeenCalled();
    });

    it.each([
      [1, '', 'empty feedback on attempt 1'],
      [1, '   ', 'whitespace feedback on attempt 1'],
      [2, '', 'empty feedback on attempt 2'],
      [2, '   ', 'whitespace feedback on attempt 2'],
    ])('missing or empty feedback: attempt %i with %s throws and saves no Evaluation (Doc 9 §9.2.12)', async (attempt, feedback) => {
      submissionFindUnique.mockResolvedValue({
        ...(attempt === 1 ? sampleSubmissionAttempt1 : sampleSubmissionAttempt2),
        ticket: sampleTicket,
      });
      if (attempt === 2) {
        mentorMessageFindMany.mockResolvedValue(sampleTranscript);
      }

      callEvaluatorModel.mockResolvedValue({
        feedback,
        scores: attempt === 2 ? {
          requirementsMet: 80,
          correctnessTests: 80,
          codeQuality: 80,
          problemSolving: 80,
        } : null,
      });

      await expect(
        evaluateSubmission(attempt === 1 ? sampleSubmissionAttempt1.id : sampleSubmissionAttempt2.id),
      ).rejects.toThrow();
      expect(evaluationCreate).not.toHaveBeenCalled();
    });

    it.each([
      [new GroqTimeoutError('Groq request timed out'), GroqTimeoutError],
      [new GroqOutageError('Groq service unavailable'), GroqOutageError],
      [new GroqMalformedResponseError('Malformed response from Groq'), GroqMalformedResponseError],
    ])(
      'provider failure: %s throws provider error and saves no Evaluation (Doc 9 §9.2.12, §9.4)',
      async (providerError, errorClass) => {
        submissionFindUnique.mockResolvedValue({
          ...sampleSubmissionAttempt1,
          ticket: sampleTicket,
        });

        callEvaluatorModel.mockRejectedValue(providerError);

        await expect(evaluateSubmission(sampleSubmissionAttempt1.id)).rejects.toThrow(errorClass);
        expect(evaluationCreate).not.toHaveBeenCalled();
      },
    );

    it('duplicate: evaluation.create rejects with unique constraint error preserves existing row with no second Evaluation (Doc 9 §9.2.12)', async () => {
      submissionFindUnique.mockResolvedValue({
        ...sampleSubmissionAttempt1,
        ticket: sampleTicket,
      });

      callEvaluatorModel.mockResolvedValue({
        feedback: 'Feedback for attempt 1',
        scores: null,
      });

      const existingEvaluation: Evaluation = {
        id: 'eval-existing',
        submissionId: sampleSubmissionAttempt1.id,
        feedback: 'Feedback for attempt 1',
        requirementsMetScore: null,
        correctnessTestsScore: null,
        codeQualityScore: null,
        problemSolvingScore: null,
        totalScore: null,
        createdAt: new Date('2026-09-25T11:01:00Z'),
      };

      const prismaUniqueError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`submissionId`)',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
        },
      );
      evaluationCreate.mockRejectedValue(prismaUniqueError);
      evaluationFindUnique.mockResolvedValue(existingEvaluation);

      const result = await evaluateSubmission(sampleSubmissionAttempt1.id);

      expect(result).toEqual(existingEvaluation);
      expect(evaluationCreate).toHaveBeenCalledTimes(1);
    });

    it('one model call: Groq called exactly once with exact EvaluationInput (Doc 9 §9.2.12)', async () => {
      submissionFindUnique.mockResolvedValue({
        ...sampleSubmissionAttempt2,
        ticket: sampleTicket,
      });
      mentorMessageFindMany.mockResolvedValue(sampleTranscript);

      callEvaluatorModel.mockResolvedValue({
        feedback: 'Final review feedback',
        scores: {
          requirementsMet: 100,
          correctnessTests: 100,
          codeQuality: 100,
          problemSolving: 100,
        },
      });

      evaluationCreate.mockResolvedValue({
        id: 'eval-100',
        submissionId: sampleSubmissionAttempt2.id,
        feedback: 'Final review feedback',
        requirementsMetScore: 100,
        correctnessTestsScore: 100,
        codeQualityScore: 100,
        problemSolvingScore: 100,
        totalScore: new Prisma.Decimal('100.00'),
        createdAt: new Date('2026-09-25T11:40:00Z'),
      });

      await evaluateSubmission(sampleSubmissionAttempt2.id);

      expect(callEvaluatorModel).toHaveBeenCalledTimes(1);
      const callArgs = callEvaluatorModel.mock.calls[0][0];
      expect(callArgs.attempt).toBe(2);
      expect(callArgs.ciPassed).toBe(true);
      expect(callArgs.diff).toBe(sampleSubmissionAttempt2.diff);
      expect(callArgs.ticketContent).toEqual(mockTicketContent);
      expect(callArgs.transcript).toHaveLength(4);
    });

    it('submission not found: throws 404 ApiError', async () => {
      submissionFindUnique.mockResolvedValue(null);

      await expect(evaluateSubmission('non-existent-id')).rejects.toThrow('Submission not found');
      expect(callEvaluatorModel).not.toHaveBeenCalled();
      expect(evaluationCreate).not.toHaveBeenCalled();
    });
  });

  describe('calculateWeightedScore', () => {
    it('all 100 and all 0 (Doc 9 §9.2.12)', () => {
      expect(
        calculateWeightedScore({
          requirementsMet: 100,
          correctnessTests: 100,
          codeQuality: 100,
          problemSolving: 100,
        }),
      ).toBe(100);

      expect(
        calculateWeightedScore({
          requirementsMet: 0,
          correctnessTests: 0,
          codeQuality: 0,
          problemSolving: 0,
        }),
      ).toBe(0);
    });

    it('requirements weight: 40% (Doc 9 §9.2.12, §9.4)', () => {
      expect(
        calculateWeightedScore({
          requirementsMet: 100,
          correctnessTests: 0,
          codeQuality: 0,
          problemSolving: 0,
        }),
      ).toBe(40);
    });

    it('correctness weight: 25% (Doc 9 §9.2.12, §9.4)', () => {
      expect(
        calculateWeightedScore({
          requirementsMet: 0,
          correctnessTests: 100,
          codeQuality: 0,
          problemSolving: 0,
        }),
      ).toBe(25);
    });

    it('code quality weight: 20% (Doc 9 §9.2.12, §9.4)', () => {
      expect(
        calculateWeightedScore({
          requirementsMet: 0,
          correctnessTests: 0,
          codeQuality: 100,
          problemSolving: 0,
        }),
      ).toBe(20);
    });

    it('problem-solving weight: 15% (Doc 9 §9.2.12, §9.4)', () => {
      expect(
        calculateWeightedScore({
          requirementsMet: 0,
          correctnessTests: 0,
          codeQuality: 0,
          problemSolving: 100,
        }),
      ).toBe(15);
    });

    it('mixed: (80, 60, 70, 90) -> 74.5 (Doc 9 §9.2.12)', () => {
      expect(
        calculateWeightedScore({
          requirementsMet: 80,
          correctnessTests: 60,
          codeQuality: 70,
          problemSolving: 90,
        }),
      ).toBe(74.5);
    });

    it('decimal input: within 0.005 of 47.4995 (Doc 9 §9.2.12)', () => {
      const result = calculateWeightedScore({
        requirementsMet: 33.33,
        correctnessTests: 66.67,
        codeQuality: 50,
        problemSolving: 50,
      });

      expect(result).toBeCloseTo(47.4995, 3);
    });

    it.each([
      [{ requirementsMet: -1, correctnessTests: 50, codeQuality: 50, problemSolving: 50 }, '-1'],
      [{ requirementsMet: 101, correctnessTests: 50, codeQuality: 50, problemSolving: 50 }, '101'],
      [{ requirementsMet: Number.NaN, correctnessTests: 50, codeQuality: 50, problemSolving: 50 }, 'NaN'],
    ])('invalid input: %j throws (Doc 9 §9.2.12)', (invalidScores) => {
      expect(() => calculateWeightedScore(invalidScores)).toThrow();
    });
  });
});
