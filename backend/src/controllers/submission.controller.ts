import { Response } from 'express';
import { AuthRequest } from '../types/index.js';
import asyncHandler from '../utils/asyncHandler.js';
import { SuccessResponse } from '../utils/ApiResponse.js';
import { HTTP_STATUS } from '../constants/index.js';
import ApiError from '../utils/ApiError.js';
import type { SubmissionAttempt } from '../types/domain.js';
import { serializeSubmission } from '../serializers/submission.serializer.js';
import * as submissionService from '../services/submission.service.js';
import * as githubService from '../services/github.service.js';

const requireUser = (req: AuthRequest) => {
  if (!req.user) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated');
  }
  return req.user;
};

/** EP-30 — attempt is never taken from the body. */
export const submit = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = requireUser(req);
  const { ticketId } = req.params as { ticketId: string };

  const row = await submissionService.submitWork(user.id, ticketId);
  const repo = await githubService.getStarterRepoSummary(user.id);

  res.status(HTTP_STATUS.ACCEPTED).json(
    new SuccessResponse(HTTP_STATUS.ACCEPTED, 'Submission received', {
      submission: serializeSubmission(row, {
        includeDiff: false,
        repoFullName: repo?.fullName ?? null,
      }),
    }),
  );
});

/** EP-31 */
export const getSubmission = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = requireUser(req);
  const { ticketId, attempt } = req.params as {
    ticketId: string;
    attempt: string;
  };
  const includeDiff =
    (req.validatedQuery?.includeDiff as boolean | undefined) ?? false;

  const submission = await submissionService.getSubmission(
    user.id,
    ticketId,
    Number(attempt) as SubmissionAttempt,
    includeDiff,
  );

  res.status(HTTP_STATUS.OK).json(
    new SuccessResponse(HTTP_STATUS.OK, 'Submission', { submission }),
  );
});

/** EP-32 */
export const retry = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = requireUser(req);
  const { ticketId, attempt } = req.params as {
    ticketId: string;
    attempt: string;
  };

  const row = await submissionService.retrySubmission(
    user.id,
    ticketId,
    Number(attempt) as SubmissionAttempt,
  );
  const repo = await githubService.getStarterRepoSummary(user.id);

  res.status(HTTP_STATUS.ACCEPTED).json(
    new SuccessResponse(HTTP_STATUS.ACCEPTED, 'Retry started', {
      submission: serializeSubmission(row, {
        includeDiff: false,
        repoFullName: repo?.fullName ?? null,
      }),
    }),
  );
});
