export type ISODateString = string;
export type UUID = string;

export interface ApiEnvelope<T> {
  statusCode: number;
  success: boolean;
  message: string;
  data: T;
}

export interface ApiResult<T> {
  data: T;
  message: string;
  statusCode: number;
}

export type ApiResponse<T> = ApiEnvelope<T>;

export interface User {
  id: UUID;
  name: string;
  email: string;
  role: string;
  emailVerifiedAt: ISODateString | null;
  createdAt: ISODateString;
}

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled';

export interface Subscription {
  id: UUID;
  status: SubscriptionStatus;
  currentPeriodEnd: ISODateString;
  canceledAt: ISODateString | null;
}

export interface SubscriptionStatusResponse {
  subscription: Subscription | null;
  hasAccess: boolean;
}

export type PaymentStatus = 'pending' | 'succeeded' | 'failed';

export interface Payment {
  id: UUID;
  amount: string;
  currency: string;
  status: PaymentStatus;
  paidAt: ISODateString | null;
  createdAt: ISODateString;
}

export type StarterTemplate = 'react' | 'node_express' | 'django';

export interface Repo {
  fullName: string;
  starterTemplate: StarterTemplate;
  defaultBranch: string;
}

export interface GitHubConnectionSummary {
  connected: boolean;
  githubLogin: string | null;
  repo: Repo | null;
}

export type TicketStatus =
  'assigned' | 'in_progress' | 'submitted_v1' | 'resubmitted' | 'done' | 'abandoned';

export interface Ticket {
  id: UUID;
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
  createdAt: ISODateString;
  completedAt: ISODateString | null;
  abandonedAt: ISODateString | null;
}

export type SubmissionAttempt = 1 | 2;
export type SubmissionStatus = 'awaiting_ci' | 'evaluating' | 'completed' | 'failed';

export interface EvaluationScores {
  requirementsMet: number;
  correctnessTests: number;
  codeQuality: number;
  problemSolving: number;
  total: number;
}

export interface Evaluation {
  feedback: string;
  scores: EvaluationScores | null;
  createdAt: ISODateString;
}

export interface Submission {
  id: UUID;
  attempt: SubmissionAttempt;
  status: SubmissionStatus;
  prNumber: number;
  prUrl: string;
  headSha: string;
  ciPassed: boolean | null;
  ciRunUrl: string | null;
  failureReason: string | null;
  submittedAt: ISODateString;
  evaluation: Evaluation | null;
  diff?: string;
}

export interface TicketWithSubmissions {
  ticket: Ticket;
  submissions: Submission[];
}

export interface AbandonResult {
  abandonedTicketId: UUID;
  newTicket: Ticket | null;
}

export type MentorMessageRole = 'user' | 'mentor';

export interface MentorMessage {
  id: UUID;
  role: MentorMessageRole;
  content: string;
  createdAt: ISODateString;
}

export interface ProfileItem {
  ticketId: UUID;
  title: string;
  category: string;
  difficulty: string;
  completedAt: ISODateString;
  evaluation: Evaluation;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
