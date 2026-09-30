import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubmissionStatus, TicketStatus } from '@prisma/client';
import ApiError from '../../src/utils/ApiError.js';
import { HTTP_STATUS } from '../../src/constants/index.js';

const ticketFindFirst = vi.fn();
const ticketUpdateMany = vi.fn();
const submissionCreate = vi.fn();
const submissionFindUnique = vi.fn();
const submissionFindUniqueOrThrow = vi.fn();
const submissionUpdateMany = vi.fn();
const transaction = vi.fn();

vi.mock('../../src/config/db.js', () => ({
  prisma: {
    ticket: {
      findFirst: ticketFindFirst,
      updateMany: ticketUpdateMany,
    },
    submission: {
      create: submissionCreate,
      findUnique: submissionFindUnique,
      findUniqueOrThrow: submissionFindUniqueOrThrow,
      updateMany: submissionUpdateMany,
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => transaction(fn),
  },
}));

const hasPaidAccess = vi.fn();
vi.mock('../../src/services/subscription.service.js', () => ({
  hasPaidAccess,
}));

const assertGitHubConnected = vi.fn();
const assertStarterRepo = vi.fn();
const getBranchSubmissionState = vi.fn();
const getStarterRepoSummary = vi.fn();
vi.mock('../../src/services/github.service.js', () => ({
  assertGitHubConnected,
  assertStarterRepo,
  getBranchSubmissionState,
  getStarterRepoSummary,
}));

const startSubmissionPipeline = vi.fn();
vi.mock('../../src/services/submission-pipeline.js', () => ({
  startSubmissionPipeline: (...args: unknown[]) => startSubmissionPipeline(...args),
}));

const {
  determineSubmissionAttempt,
  submitWork,
  getSubmission,
  retrySubmission,
} = await import('../../src/services/submission.service.js');

const userId = 'user-1';
const ticketId = '11111111-1111-4111-8111-111111111111';

const branchState = {
  fullName: 'ada/starter',
  branchName: 'ticket/x',
  defaultBranch: 'main',
  prNumber: 7,
  prUrl: 'https://github.com/ada/starter/pull/7',
  headSha: 'deadbeef',
  diff: 'diff --git a/App.tsx',
};

const ticketInProgress = {
  id: ticketId,
  userId,
  status: TicketStatus.in_progress,
  branchName: 'ticket/x',
};

describe('submission.service (doc 9 §9.2.11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasPaidAccess.mockResolvedValue(true);
    assertGitHubConnected.mockResolvedValue(undefined);
    assertStarterRepo.mockResolvedValue({ fullName: 'ada/starter', defaultBranch: 'main' });
    getBranchSubmissionState.mockResolvedValue(branchState);
    getStarterRepoSummary.mockResolvedValue({
      fullName: 'ada/starter',
      defaultBranch: 'main',
    });
    startSubmissionPipeline.mockResolvedValue(undefined);

    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        ticket: { updateMany: ticketUpdateMany },
        submission: { create: submissionCreate },
      };
      return fn(tx);
    });
  });

  describe('determineSubmissionAttempt', () => {
    it('maps in_progress → 1 and submitted_v1 → 2', () => {
      expect(determineSubmissionAttempt(TicketStatus.in_progress)).toBe(1);
      expect(determineSubmissionAttempt(TicketStatus.submitted_v1)).toBe(2);
    });

    it.each([
      TicketStatus.assigned,
      TicketStatus.resubmitted,
      TicketStatus.done,
      TicketStatus.abandoned,
    ] as const)('throws 409 for %s', (status) => {
      expect(() => determineSubmissionAttempt(status)).toThrow(ApiError);
      try {
        determineSubmissionAttempt(status);
      } catch (err) {
        expect(err).toMatchObject({
          statusCode: HTTP_STATUS.CONFLICT,
          message: 'This ticket cannot be submitted in its current state',
        });
      }
    });
  });

  describe('submitWork', () => {
    it('creates attempt 1 awaiting_ci and advances ticket to submitted_v1', async () => {
      ticketFindFirst.mockResolvedValue(ticketInProgress);
      ticketUpdateMany.mockResolvedValue({ count: 1 });
      const created = {
        id: 'sub-1',
        ticketId,
        attempt: 1,
        status: SubmissionStatus.awaiting_ci,
        prNumber: 7,
        headSha: 'deadbeef',
        diff: branchState.diff,
      };
      submissionCreate.mockResolvedValue(created);

      const result = await submitWork(userId, ticketId);

      expect(getBranchSubmissionState).toHaveBeenCalledWith(userId, 'ticket/x');
      expect(ticketUpdateMany).toHaveBeenCalledWith({
        where: { id: ticketId, userId, status: TicketStatus.in_progress },
        data: { status: TicketStatus.submitted_v1 },
      });
      expect(submissionCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ticketId,
          attempt: 1,
          status: SubmissionStatus.awaiting_ci,
          prNumber: 7,
          headSha: 'deadbeef',
          diff: branchState.diff,
        }),
      });
      expect(result.attempt).toBe(1);
      expect(result.diff).toBe(branchState.diff);
      expect(startSubmissionPipeline).toHaveBeenCalledWith('sub-1');
    });

    it('creates attempt 2 reusing PR when attempt 1 is completed', async () => {
      ticketFindFirst.mockResolvedValue({
        ...ticketInProgress,
        status: TicketStatus.submitted_v1,
      });
      submissionFindUnique.mockResolvedValue({
        id: 'sub-1',
        attempt: 1,
        status: SubmissionStatus.completed,
        prNumber: 7,
      });
      ticketUpdateMany.mockResolvedValue({ count: 1 });
      submissionCreate.mockResolvedValue({
        id: 'sub-2',
        ticketId,
        attempt: 2,
        status: SubmissionStatus.awaiting_ci,
        prNumber: 7,
        headSha: 'deadbeef',
        diff: branchState.diff,
      });

      const result = await submitWork(userId, ticketId);

      expect(result.attempt).toBe(2);
      expect(result.prNumber).toBe(7);
      expect(ticketUpdateMany).toHaveBeenCalledWith({
        where: { id: ticketId, userId, status: TicketStatus.submitted_v1 },
        data: { status: TicketStatus.resubmitted },
      });
    });

    it.each([SubmissionStatus.awaiting_ci, SubmissionStatus.evaluating, SubmissionStatus.failed])(
      'throws 409 when attempt 1 is still %s',
      async (status) => {
        ticketFindFirst.mockResolvedValue({
          ...ticketInProgress,
          status: TicketStatus.submitted_v1,
        });
        submissionFindUnique.mockResolvedValue({ id: 'sub-1', attempt: 1, status });

        await expect(submitWork(userId, ticketId)).rejects.toMatchObject({
          statusCode: HTTP_STATUS.CONFLICT,
          message: 'Wait for feedback on your first submission before resubmitting',
        });
        expect(submissionCreate).not.toHaveBeenCalled();
      },
    );

    it.each([
      TicketStatus.assigned,
      TicketStatus.resubmitted,
      TicketStatus.done,
      TicketStatus.abandoned,
    ] as const)('throws 409 for ticket status %s', async (status) => {
      ticketFindFirst.mockResolvedValue({ ...ticketInProgress, status });

      await expect(submitWork(userId, ticketId)).rejects.toMatchObject({
        statusCode: HTTP_STATUS.CONFLICT,
        message: 'This ticket cannot be submitted in its current state',
      });
      expect(submissionCreate).not.toHaveBeenCalled();
    });

    it('propagates 400 when GitHub reports no commits', async () => {
      ticketFindFirst.mockResolvedValue(ticketInProgress);
      getBranchSubmissionState.mockRejectedValue(
        new ApiError(HTTP_STATUS.BAD_REQUEST, "No commits found on branch 'ticket/x'. Push your work before submitting"),
      );

      await expect(submitWork(userId, ticketId)).rejects.toMatchObject({
        statusCode: HTTP_STATUS.BAD_REQUEST,
      });
      expect(submissionCreate).not.toHaveBeenCalled();
    });

    it('throws 402 without paid access', async () => {
      hasPaidAccess.mockResolvedValue(false);
      await expect(submitWork(userId, ticketId)).rejects.toMatchObject({
        statusCode: HTTP_STATUS.PAYMENT_REQUIRED,
      });
    });

    it('propagates 403 from GitHub connection', async () => {
      assertGitHubConnected.mockRejectedValue(
        new ApiError(HTTP_STATUS.FORBIDDEN, 'GitHub is not connected. Connect GitHub to continue'),
      );
      await expect(submitWork(userId, ticketId)).rejects.toMatchObject({
        statusCode: HTTP_STATUS.FORBIDDEN,
      });
    });

    it('throws 404 when ticket is not owned', async () => {
      ticketFindFirst.mockResolvedValue(null);
      await expect(submitWork(userId, ticketId)).rejects.toMatchObject({
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Ticket not found',
      });
    });

    it('throws 502 when GitHub read fails', async () => {
      ticketFindFirst.mockResolvedValue(ticketInProgress);
      getBranchSubmissionState.mockRejectedValue(new Error('network'));

      await expect(submitWork(userId, ticketId)).rejects.toMatchObject({
        statusCode: HTTP_STATUS.BAD_GATEWAY,
        message: 'Could not read your pull request from GitHub, please try again',
      });
    });

    it('double submit: second conditional update loses with 409', async () => {
      ticketFindFirst.mockResolvedValue(ticketInProgress);
      ticketUpdateMany.mockResolvedValue({ count: 0 });

      await expect(submitWork(userId, ticketId)).rejects.toMatchObject({
        statusCode: HTTP_STATUS.CONFLICT,
      });
      expect(submissionCreate).not.toHaveBeenCalled();
    });
  });

  describe('getSubmission', () => {
    it('returns processing submission without selecting diff when includeDiff=false', async () => {
      ticketFindFirst.mockResolvedValue({ id: ticketId });
      submissionFindUnique.mockResolvedValue({
        id: 'sub-1',
        attempt: 1,
        status: SubmissionStatus.awaiting_ci,
        prNumber: 7,
        headSha: 'deadbeef',
        ciPassed: null,
        ciRunUrl: null,
        failureReason: null,
        submittedAt: new Date('2026-04-01T00:00:00.000Z'),
        evaluation: null,
      });

      const view = await getSubmission(userId, ticketId, 1, false);

      expect(submissionFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({ diff: false }),
        }),
      );
      expect(view).not.toHaveProperty('diff');
      expect(view.evaluation).toBeNull();
    });

    it('includes diff when requested', async () => {
      ticketFindFirst.mockResolvedValue({ id: ticketId });
      submissionFindUnique.mockResolvedValue({
        id: 'sub-1',
        attempt: 1,
        status: SubmissionStatus.awaiting_ci,
        prNumber: 7,
        headSha: 'deadbeef',
        ciPassed: null,
        ciRunUrl: null,
        failureReason: null,
        submittedAt: new Date('2026-04-01T00:00:00.000Z'),
        evaluation: null,
        diff: branchState.diff,
      });

      const view = await getSubmission(userId, ticketId, 1, true);
      expect(view.diff).toBe(branchState.diff);
    });

    it('returns null scores for completed attempt 1', async () => {
      ticketFindFirst.mockResolvedValue({ id: ticketId });
      submissionFindUnique.mockResolvedValue({
        id: 'sub-1',
        attempt: 1,
        status: SubmissionStatus.completed,
        prNumber: 7,
        headSha: 'deadbeef',
        ciPassed: true,
        ciRunUrl: null,
        failureReason: null,
        submittedAt: new Date('2026-04-01T00:00:00.000Z'),
        evaluation: {
          feedback: 'nice',
          requirementsMetScore: null,
          correctnessTestsScore: null,
          codeQualityScore: null,
          problemSolvingScore: null,
          totalScore: null,
          createdAt: new Date('2026-04-01T01:00:00.000Z'),
        },
      });

      const view = await getSubmission(userId, ticketId, 1, false);
      expect(view.evaluation?.scores).toBeNull();
    });

    it('returns category scores for completed attempt 2', async () => {
      ticketFindFirst.mockResolvedValue({ id: ticketId });
      submissionFindUnique.mockResolvedValue({
        id: 'sub-2',
        attempt: 2,
        status: SubmissionStatus.completed,
        prNumber: 7,
        headSha: 'cafe',
        ciPassed: true,
        ciRunUrl: null,
        failureReason: null,
        submittedAt: new Date('2026-04-02T00:00:00.000Z'),
        evaluation: {
          feedback: 'done',
          requirementsMetScore: 80,
          correctnessTestsScore: 60,
          codeQualityScore: 70,
          problemSolvingScore: 90,
          totalScore: 74.5,
          createdAt: new Date('2026-04-02T01:00:00.000Z'),
        },
      });

      const view = await getSubmission(userId, ticketId, 2, false);
      expect(view.evaluation?.scores).toEqual({
        requirementsMet: 80,
        correctnessTests: 60,
        codeQuality: 70,
        problemSolving: 90,
        total: 74.5,
      });
    });

    it('returns failed status and reason', async () => {
      ticketFindFirst.mockResolvedValue({ id: ticketId });
      submissionFindUnique.mockResolvedValue({
        id: 'sub-1',
        attempt: 1,
        status: SubmissionStatus.failed,
        prNumber: 7,
        headSha: 'deadbeef',
        ciPassed: false,
        ciRunUrl: null,
        failureReason: 'CI cancelled',
        submittedAt: new Date('2026-04-01T00:00:00.000Z'),
        evaluation: null,
      });

      const view = await getSubmission(userId, ticketId, 1, false);
      expect(view.status).toBe(SubmissionStatus.failed);
      expect(view.failureReason).toBe('CI cancelled');
    });

    it('throws 404 Submission not found when missing or not owned', async () => {
      ticketFindFirst.mockResolvedValue(null);
      await expect(getSubmission(userId, ticketId, 1, false)).rejects.toMatchObject({
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Submission not found',
      });

      ticketFindFirst.mockResolvedValue({ id: ticketId });
      submissionFindUnique.mockResolvedValue(null);
      await expect(getSubmission(userId, ticketId, 1, false)).rejects.toMatchObject({
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Submission not found',
      });
    });
  });

  describe('retrySubmission', () => {
    const failedRow = {
      id: 'sub-1',
      ticketId,
      attempt: 1,
      status: SubmissionStatus.failed,
      prNumber: 7,
      headSha: 'deadbeef',
      diff: branchState.diff,
      failureReason: 'boom',
    };

    it('resets the same failed row to awaiting_ci and starts the pipeline once', async () => {
      ticketFindFirst.mockResolvedValue({ id: ticketId });
      submissionFindUnique.mockResolvedValue(failedRow);
      submissionUpdateMany.mockResolvedValue({ count: 1 });
      submissionFindUniqueOrThrow.mockResolvedValue({
        ...failedRow,
        status: SubmissionStatus.awaiting_ci,
        failureReason: null,
      });

      const result = await retrySubmission(userId, ticketId, 1);

      expect(submissionUpdateMany).toHaveBeenCalledWith({
        where: { id: 'sub-1', status: SubmissionStatus.failed },
        data: expect.objectContaining({
          status: SubmissionStatus.awaiting_ci,
          failureReason: null,
        }),
      });
      expect(result.id).toBe('sub-1');
      expect(result.attempt).toBe(1);
      expect(result.prNumber).toBe(7);
      expect(result.headSha).toBe('deadbeef');
      expect(startSubmissionPipeline).toHaveBeenCalledTimes(1);
      expect(submissionCreate).not.toHaveBeenCalled();
    });

    it.each([
      SubmissionStatus.awaiting_ci,
      SubmissionStatus.evaluating,
      SubmissionStatus.completed,
    ])('throws 409 when status is %s', async (status) => {
      ticketFindFirst.mockResolvedValue({ id: ticketId });
      submissionFindUnique.mockResolvedValue({ ...failedRow, status });

      await expect(retrySubmission(userId, ticketId, 1)).rejects.toMatchObject({
        statusCode: HTTP_STATUS.CONFLICT,
        message: 'Only a failed submission can be retried',
      });
    });

    it('concurrent retry loses when conditional update returns 0', async () => {
      ticketFindFirst.mockResolvedValue({ id: ticketId });
      submissionFindUnique.mockResolvedValue(failedRow);
      submissionUpdateMany.mockResolvedValue({ count: 0 });

      await expect(retrySubmission(userId, ticketId, 1)).rejects.toMatchObject({
        statusCode: HTTP_STATUS.CONFLICT,
      });
      expect(startSubmissionPipeline).not.toHaveBeenCalled();
    });

    it('throws 402 without paid access and 404 when not owned', async () => {
      hasPaidAccess.mockResolvedValue(false);
      await expect(retrySubmission(userId, ticketId, 1)).rejects.toMatchObject({
        statusCode: HTTP_STATUS.PAYMENT_REQUIRED,
      });

      hasPaidAccess.mockResolvedValue(true);
      ticketFindFirst.mockResolvedValue(null);
      await expect(retrySubmission(userId, ticketId, 1)).rejects.toMatchObject({
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'Submission not found',
      });
    });
  });
});
