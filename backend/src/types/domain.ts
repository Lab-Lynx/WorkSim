/**
 * Shared domain contracts referenced by Doc 8 §8.5–8.12 service signatures.
 * Types only — no runtime logic. Prisma enums are re-exported, not duplicated.
 */

import type {
  MentorMessageRole,
  StarterTemplate as PrismaStarterTemplate,
  SubmissionStatus,
  TicketStatus,
} from '@prisma/client';

export type {
  MentorMessageRole,
  PaymentStatus,
  StarterTemplate,
  SubmissionStatus,
  SubscriptionStatus,
  TicketStatus,
} from '@prisma/client';

/** Snapshot stored in Ticket.content and returned on API Ticket fields (Doc 5 §5.3.0). */
export interface TicketContent {
  title: string;
  scenario: string;
  category: string;
  difficulty: string;
  touchedFiles: string[];
  acceptanceCriteria: string[];
  testChecklist: string[];
}

/**
 * Team-authored template structure in the codebase (not a DB row).
 * Gemini fills wording into TicketContent without changing these fixed fields.
 */
export interface TicketTemplate {
  key: string;
  category: string;
  difficulty: string;
  touchedFiles: string[];
  /** Structure skeleton for acceptance criteria (filled by generation). */
  acceptanceCriteriaStructure: string[];
  /** Structure skeleton for the test checklist (filled by generation). */
  testChecklistStructure: string[];
}

/** Q-09 selection strategy returns a key only; loadTicketTemplate loads the definition. */
export interface TicketTemplateSelection {
  templateKey: string;
}

/** Minimal context for ticket-content generation — no invented product fields. */
export interface TicketGenerationContext {
  userId: string;
  starterTemplate: PrismaStarterTemplate;
}

export interface RepoSummary {
  fullName: string;
  starterTemplate: PrismaStarterTemplate;
  defaultBranch: string;
}

/** Doc 8 getGitHubConnection / Doc 5–10 connection summary. */
export interface GitHubConnectionSummary {
  connected: boolean;
  githubLogin: string | null;
  repo: RepoSummary | null;
}

/**
 * Branch/PR/diff state used by submitWork (Doc 8 getBranchSubmissionState).
 */
export interface GitHubSubmissionState {
  fullName: string;
  branchName: string;
  defaultBranch: string;
  prNumber: number;
  prUrl: string;
  headSha: string;
  diff: string;
}

/**
 * Minimal verified workflow_run fields for EP-33 matching (Doc 8 / Doc 5).
 * Nested to mirror GitHub's payload shape enough for repo + SHA + conclusion.
 */
export interface GitHubWorkflowRunEvent {
  action: string;
  repository: {
    full_name: string;
  };
  workflow_run: {
    head_sha: string;
    conclusion: string | null;
    html_url: string;
    status: string;
  };
}

/**
 * Normalized Chapa webhook after signature verification (Doc 5 EP-14).
 * Mapping from raw Chapa JSON field names is the Chapa adapter's job (Q-05 open).
 */
export interface ChapaWebhookPayload {
  /** Matched to Payment.chapaTxRef */
  txRef: string;
  /** Payment outcome from the provider */
  status: 'pending' | 'succeeded' | 'failed' | string;
}

/** FR-38 progressive hint stages — client cannot select these. */
export type MentorHintStage =
  | 'ask_what_tried'
  | 'conceptual_hint'
  | 'point_to_file'
  | 'specific_suggestion';

export interface MentorTranscriptMessage {
  role: MentorMessageRole;
  content: string;
}

export interface MentorModelInput {
  ticketContent: TicketContent;
  transcript: MentorTranscriptMessage[];
  userMessage: string;
  hintStage: MentorHintStage;
}

export type SubmissionAttempt = 1 | 2;

export interface EvaluationInput {
  attempt: SubmissionAttempt;
  ticketContent: TicketContent;
  diff: string;
  /** Required — evaluator never receives the diff alone (FR-43). */
  ciPassed: boolean;
  /** Included on attempt 2 for the problem-solving rubric category. */
  transcript?: MentorTranscriptMessage[];
}

/** Category scores from the model; weighted total is computed in app code. */
export interface EvaluatorCategoryScores {
  requirementsMet: number;
  correctnessTests: number;
  codeQuality: number;
  problemSolving: number;
}

export interface EvaluatorOutput {
  feedback: string;
  /** null on attempt 1 (feedback only); filled on attempt 2. */
  scores: EvaluatorCategoryScores | null;
}

/** API Evaluation object (Doc 5 §5.3.0) — scores keys differ from DB columns. */
export interface EvaluationScores {
  requirementsMet: number;
  correctnessTests: number;
  codeQuality: number;
  problemSolving: number;
  total: number;
}

export interface EvaluationView {
  feedback: string;
  scores: EvaluationScores | null;
  createdAt: string;
}

/** Doc 5 Submission object; diff only when includeDiff=true (EP-31). */
export interface SubmissionView {
  id: string;
  attempt: SubmissionAttempt;
  status: SubmissionStatus;
  prNumber: number;
  prUrl: string;
  headSha: string;
  ciPassed: boolean | null;
  ciRunUrl: string | null;
  failureReason: string | null;
  submittedAt: string;
  evaluation: EvaluationView | null;
  diff?: string;
}

/** API Ticket shape used in ticket + profile responses (Doc 5 §5.3.0). */
export interface TicketView {
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
  branchName: string;
  repo: {
    fullName: string;
    defaultBranch: string;
  };
  createdAt: string;
  completedAt: string | null;
  abandonedAt: string | null;
}

/** Doc 8 getTicketById — ticket plus 0–2 submissions without full diff. */
export interface TicketWithSubmissions {
  ticket: TicketView;
  submissions: SubmissionView[];
}

/** Doc 5 / Doc 8 getExperienceProfile — done tickets only. */
export interface ProfileItem {
  ticketId: string;
  title: string;
  category: string;
  difficulty: string;
  completedAt: string;
  evaluation: EvaluationView;
}
