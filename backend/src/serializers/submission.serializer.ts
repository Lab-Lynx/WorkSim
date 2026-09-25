import type { SubmissionStatus } from '@prisma/client';
import {
  serializeEvaluation,
  type SerializeEvaluationInput,
  type SerializedEvaluation,
} from './evaluation.serializer.js';

export type SerializeSubmissionInput = {
  id: string;
  attempt: number;
  status: SubmissionStatus | string;
  prNumber: number;
  headSha: string;
  ciPassed: boolean | null;
  ciRunUrl: string | null;
  failureReason: string | null;
  submittedAt: Date;
  evaluation?: SerializeEvaluationInput;
  /** Only included in output when opts.includeDiff is true. */
  diff?: string;
};

export type SerializeSubmissionOptions = {
  includeDiff?: boolean;
  repoFullName: string | null;
};

export type SerializedSubmission = {
  id: string;
  attempt: number;
  status: string;
  prNumber: number;
  prUrl: string;
  headSha: string;
  ciPassed: boolean | null;
  ciRunUrl: string | null;
  failureReason: string | null;
  submittedAt: string;
  evaluation: SerializedEvaluation;
  diff?: string;
};

/** Doc 5 Submission — prUrl from repo fullName; diff key only when requested. */
export const serializeSubmission = (
  submission: SerializeSubmissionInput,
  opts: SerializeSubmissionOptions,
): SerializedSubmission => {
  const ownerRepo = opts.repoFullName ?? 'unknown/unknown';
  const result: SerializedSubmission = {
    id: submission.id,
    attempt: submission.attempt,
    status: String(submission.status),
    prNumber: submission.prNumber,
    prUrl: `https://github.com/${ownerRepo}/pull/${submission.prNumber}`,
    headSha: submission.headSha,
    ciPassed: submission.ciPassed,
    ciRunUrl: submission.ciRunUrl,
    failureReason: submission.failureReason,
    submittedAt: submission.submittedAt.toISOString(),
    evaluation: serializeEvaluation(submission.evaluation ?? null),
  };

  if (opts.includeDiff) {
    result.diff = submission.diff ?? '';
  }

  return result;
};
