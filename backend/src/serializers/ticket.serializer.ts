import type { TicketStatus, SubmissionStatus } from '@prisma/client';
import type { TicketContent } from '../types/domain.js';
import {
  serializeEvaluation,
  type SerializeEvaluationInput,
  type SerializedEvaluation,
} from './evaluation.serializer.js';

export type { SerializeEvaluationInput, SerializedEvaluation };

export type SerializedTicket = {
  id: string;
  status: TicketStatus;
  templateKey: string;
  title: string;
  scenario: string;
  category: string;
  difficulty: string;
  touchedFiles: string[];
  acceptanceCriteria: string[];
  testChecklist: string[];
  branchName: string | null;
  repo: { fullName: string; defaultBranch: string } | null;
  createdAt: string;
  completedAt: string | null;
  abandonedAt: string | null;
};

export type SerializeTicketInput = {
  id: string;
  status: TicketStatus;
  templateKey: string;
  content: TicketContent;
  branchName: string | null;
  createdAt: Date;
  completedAt: Date | null;
  abandonedAt: Date | null;
};

export type SerializeRepoInput = {
  fullName: string;
  defaultBranch: string;
} | null;

/** Doc 5 Ticket object — flattens Ticket.content keys. */
export const serializeTicket = (
  ticket: SerializeTicketInput,
  repo: SerializeRepoInput,
): SerializedTicket => ({
  id: ticket.id,
  status: ticket.status,
  templateKey: ticket.templateKey,
  title: ticket.content.title,
  scenario: ticket.content.scenario,
  category: ticket.content.category,
  difficulty: ticket.content.difficulty,
  touchedFiles: [...ticket.content.touchedFiles],
  acceptanceCriteria: [...ticket.content.acceptanceCriteria],
  testChecklist: [...ticket.content.testChecklist],
  branchName: ticket.branchName,
  repo: repo
    ? { fullName: repo.fullName, defaultBranch: repo.defaultBranch }
    : null,
  createdAt: ticket.createdAt.toISOString(),
  completedAt: ticket.completedAt ? ticket.completedAt.toISOString() : null,
  abandonedAt: ticket.abandonedAt ? ticket.abandonedAt.toISOString() : null,
});

export type SerializeSubmissionSummaryInput = {
  id: string;
  attempt: number;
  status: SubmissionStatus | string;
  prNumber: number;
  headSha: string;
  ciPassed: boolean | null;
  ciRunUrl: string | null;
  failureReason: string | null;
  submittedAt: Date;
  evaluation: SerializeEvaluationInput;
};

export type SerializedSubmissionSummary = {
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
};

/** EP-25 submission summary — never includes `diff`. */
export const serializeSubmissionSummary = (
  submission: SerializeSubmissionSummaryInput,
  repoFullName: string | null,
): SerializedSubmissionSummary => {
  const ownerRepo = repoFullName ?? 'unknown/unknown';
  return {
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
    evaluation: serializeEvaluation(submission.evaluation),
  };
};
