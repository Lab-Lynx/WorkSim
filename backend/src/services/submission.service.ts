import {
  Prisma,
  SubmissionStatus,
  TicketStatus,
  type Submission,
} from '@prisma/client';
import { prisma } from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import type { SubmissionAttempt, SubmissionView } from '../types/domain.js';
import { hasPaidAccess } from './subscription.service.js';
import * as githubService from './github.service.js';
import { serializeSubmission } from '../serializers/submission.serializer.js';
import { startSubmissionPipeline } from './submission-pipeline.js';

const WRONG_TICKET_STATE = 'This ticket cannot be submitted in its current state';
const WAIT_FOR_FEEDBACK =
  'Wait for feedback on your first submission before resubmitting';
const SUBMISSION_NOT_FOUND = 'Submission not found';
const ONLY_FAILED_RETRY = 'Only a failed submission can be retried';
const TICKET_NOT_FOUND = 'Ticket not found';

/** Derive pass from ticket state — client never supplies attempt (EP-30). */
export const determineSubmissionAttempt = (
  ticketStatus: TicketStatus,
): SubmissionAttempt => {
  if (ticketStatus === TicketStatus.in_progress) return 1;
  if (ticketStatus === TicketStatus.submitted_v1) return 2;
  throw new ApiError(HTTP_STATUS.CONFLICT, WRONG_TICKET_STATE);
};

const requireOwnedTicket = async (userId: string, ticketId: string) => {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, userId },
  });
  if (!ticket) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, TICKET_NOT_FOUND);
  }
  return ticket;
};

/**
 * Submit work on the ticket branch (EP-30 / Doc 8 submitWork).
 */
export const submitWork = async (
  userId: string,
  ticketId: string,
): Promise<Submission> => {
  if (!(await hasPaidAccess(userId))) {
    throw new ApiError(HTTP_STATUS.PAYMENT_REQUIRED, 'An active subscription is required');
  }

  await githubService.assertGitHubConnected(userId);
  await githubService.assertStarterRepo(userId);

  const ticket = await requireOwnedTicket(userId, ticketId);

  let attempt: SubmissionAttempt;
  try {
    attempt = determineSubmissionAttempt(ticket.status);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(HTTP_STATUS.CONFLICT, WRONG_TICKET_STATE);
  }

  if (attempt === 2) {
    const first = await prisma.submission.findUnique({
      where: { ticketId_attempt: { ticketId, attempt: 1 } },
    });
    if (!first || first.status !== SubmissionStatus.completed) {
      throw new ApiError(HTTP_STATUS.CONFLICT, WAIT_FOR_FEEDBACK);
    }
  }

  if (!ticket.branchName) {
    throw new ApiError(HTTP_STATUS.CONFLICT, WRONG_TICKET_STATE);
  }

  let branchState;
  try {
    branchState = await githubService.getBranchSubmissionState(userId, ticket.branchName);
  } catch (err) {
    if (err instanceof ApiError) {
      if (
        err.statusCode === HTTP_STATUS.BAD_REQUEST ||
        err.statusCode === HTTP_STATUS.FORBIDDEN ||
        err.statusCode === HTTP_STATUS.BAD_GATEWAY
      ) {
        throw err;
      }
    }
    throw new ApiError(HTTP_STATUS.BAD_GATEWAY, 'Could not read your pull request from GitHub, please try again');
  }

  const expectedStatus =
    attempt === 1 ? TicketStatus.in_progress : TicketStatus.submitted_v1;
  const nextStatus =
    attempt === 1 ? TicketStatus.submitted_v1 : TicketStatus.resubmitted;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.updateMany({
        where: { id: ticketId, userId, status: expectedStatus },
        data: { status: nextStatus },
      });
      if (updated.count !== 1) {
        throw new ApiError(HTTP_STATUS.CONFLICT, WRONG_TICKET_STATE);
      }

      return tx.submission.create({
        data: {
          ticketId,
          attempt,
          status: SubmissionStatus.awaiting_ci,
          prNumber: branchState.prNumber,
          headSha: branchState.headSha,
          diff: branchState.diff,
        },
      });
    });

    await startSubmissionPipeline(created.id);
    return created;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new ApiError(HTTP_STATUS.CONFLICT, WRONG_TICKET_STATE);
    }
    throw err;
  }
};

/**
 * Poll / history for one attempt (EP-31).
 * Diff is omitted from the Prisma select unless includeDiff is true.
 */
export const getSubmission = async (
  userId: string,
  ticketId: string,
  attempt: SubmissionAttempt,
  includeDiff: boolean,
): Promise<SubmissionView> => {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, userId },
    select: { id: true },
  });
  if (!ticket) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, SUBMISSION_NOT_FOUND);
  }

  const row = await prisma.submission.findUnique({
    where: { ticketId_attempt: { ticketId, attempt } },
    select: {
      id: true,
      attempt: true,
      status: true,
      prNumber: true,
      headSha: true,
      ciPassed: true,
      ciRunUrl: true,
      failureReason: true,
      submittedAt: true,
      diff: includeDiff,
      evaluation: {
        select: {
          feedback: true,
          requirementsMetScore: true,
          correctnessTestsScore: true,
          codeQualityScore: true,
          problemSolvingScore: true,
          totalScore: true,
          createdAt: true,
        },
      },
    },
  });

  if (!row) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, SUBMISSION_NOT_FOUND);
  }

  const repo = await githubService.getStarterRepoSummary(userId);

  return serializeSubmission(
    {
      id: row.id,
      attempt: row.attempt as SubmissionAttempt,
      status: row.status,
      prNumber: row.prNumber,
      headSha: row.headSha,
      ciPassed: row.ciPassed,
      ciRunUrl: row.ciRunUrl,
      failureReason: row.failureReason,
      submittedAt: row.submittedAt,
      evaluation: row.evaluation,
      diff: includeDiff ? (row as { diff?: string }).diff : undefined,
    },
    { includeDiff, repoFullName: repo?.fullName ?? null },
  ) as SubmissionView;
};

/**
 * Re-run CI/evaluator for a failed submission (EP-32) — same row, not a new attempt.
 */
export const retrySubmission = async (
  userId: string,
  ticketId: string,
  attempt: SubmissionAttempt,
): Promise<Submission> => {
  if (!(await hasPaidAccess(userId))) {
    throw new ApiError(HTTP_STATUS.PAYMENT_REQUIRED, 'An active subscription is required');
  }

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, userId },
    select: { id: true },
  });
  if (!ticket) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, SUBMISSION_NOT_FOUND);
  }

  const existing = await prisma.submission.findUnique({
    where: { ticketId_attempt: { ticketId, attempt } },
  });
  if (!existing) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, SUBMISSION_NOT_FOUND);
  }
  if (existing.status !== SubmissionStatus.failed) {
    throw new ApiError(HTTP_STATUS.CONFLICT, ONLY_FAILED_RETRY);
  }

  const updated = await prisma.submission.updateMany({
    where: { id: existing.id, status: SubmissionStatus.failed },
    data: {
      status: SubmissionStatus.awaiting_ci,
      failureReason: null,
      ciPassed: null,
      ciRunUrl: null,
    },
  });

  if (updated.count !== 1) {
    throw new ApiError(HTTP_STATUS.CONFLICT, ONLY_FAILED_RETRY);
  }

  const row = await prisma.submission.findUniqueOrThrow({
    where: { id: existing.id },
  });

  await startSubmissionPipeline(row.id);
  return row;
};
