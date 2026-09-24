/**
 * Compile-time check: Doc 8 §8.5–8.12 signatures type-check against domain types.
 * No runtime service behavior — types and expectTypeOf only (coverage honesty).
 */
import { describe, expectTypeOf, it } from 'vitest';
import type {
  Evaluation as PrismaEvaluation,
  MentorMessage,
  Payment,
  Prisma,
  StarterRepo,
  Submission,
  Subscription,
  Ticket,
} from '@prisma/client';
import type {
  ChapaWebhookPayload,
  EvaluationInput,
  EvaluatorOutput,
  GitHubConnectionSummary,
  GitHubSubmissionState,
  GitHubWorkflowRunEvent,
  MentorHintStage,
  MentorModelInput,
  ProfileItem,
  StarterTemplate,
  SubmissionAttempt,
  SubmissionView,
  TicketContent,
  TicketGenerationContext,
  TicketStatus,
  TicketTemplate,
  TicketTemplateSelection,
  TicketWithSubmissions,
} from '../../src/types/domain.js';

// --- Doc 8 §8.5 Subscription & Chapa ---
type CreateCheckout = (userId: string) => Promise<{ checkoutUrl: string }>;
type ProcessChapaWebhook = (payload: ChapaWebhookPayload) => Promise<void>;
type GetSubscriptionStatus = (
  userId: string,
) => Promise<{ subscription: Subscription | null; hasAccess: boolean }>;
type CancelSubscription = (userId: string) => Promise<Subscription>;
type ListPayments = (userId: string) => Promise<Payment[]>;
type HasPaidAccess = (userId: string, now?: Date) => Promise<boolean>;
type ProcessUpcomingRenewals = () => Promise<{
  remindersSent: number;
  chargesAttempted: number;
  chargesSucceeded: number;
  chargesFailed: number;
}>;

// --- Doc 8 §8.6 GitHub ---
type CreateGitHubAuthorizeUrl = (userId: string) => Promise<string>;
type HandleGitHubCallback = (userId: string, code: string, state: string) => Promise<void>;
type GetGitHubConnection = (userId: string) => Promise<GitHubConnectionSummary>;
type DisconnectGitHub = (userId: string) => Promise<void>;
type CreateStarterRepo = (
  userId: string,
  starterTemplate: StarterTemplate,
  repoName?: string,
) => Promise<StarterRepo>;
type CreateTicketBranch = (
  userId: string,
  branchName: string,
  baseBranch: string,
) => Promise<void>;
type GetBranchSubmissionState = (
  userId: string,
  branchName: string,
) => Promise<GitHubSubmissionState>;

// --- Doc 8 §8.7 Ticket generation & lifecycle ---
type LoadTicketTemplate = (templateKey: string) => TicketTemplate;
type SelectNextTicketTemplate = (userId: string) => Promise<TicketTemplateSelection>;
type GenerateTicketContent = (
  template: TicketTemplate,
  context: TicketGenerationContext,
) => Promise<TicketContent>;
type AssignNextTicket = (userId: string) => Promise<Ticket>;
type GetCurrentTicket = (userId: string) => Promise<Ticket | null>;
type GetTicketById = (userId: string, ticketId: string) => Promise<TicketWithSubmissions>;
type StartTicket = (userId: string, ticketId: string) => Promise<Ticket>;
type AbandonTicket = (
  userId: string,
  ticketId: string,
) => Promise<{ abandonedTicketId: string; newTicket: Ticket | null }>;

// --- Doc 8 §8.8 Mentor ---
type GetMentorHintStage = (messages: MentorMessage[]) => MentorHintStage;
type SendMentorMessage = (
  userId: string,
  ticketId: string,
  content: string,
) => Promise<{ userMessage: MentorMessage; mentorMessage: MentorMessage }>;
type CallMentorModel = (input: MentorModelInput) => Promise<string>;
type CanSendMentorMessage = (ticketId: string, now?: Date) => Promise<boolean>;

// --- Doc 8 §8.9 Submission ---
type DetermineSubmissionAttempt = (ticketStatus: TicketStatus) => SubmissionAttempt;
type SubmitWork = (userId: string, ticketId: string) => Promise<Submission>;
type GetSubmission = (
  userId: string,
  ticketId: string,
  attempt: SubmissionAttempt,
  includeDiff: boolean,
) => Promise<SubmissionView>;
type RetrySubmission = (
  userId: string,
  ticketId: string,
  attempt: SubmissionAttempt,
) => Promise<Submission>;

// --- Doc 8 §8.10 Evaluation ---
type BuildEvaluationInput = (
  submission: Submission,
  ticket: Ticket,
  transcript?: MentorMessage[],
) => EvaluationInput;
type EvaluateSubmission = (submissionId: string) => Promise<PrismaEvaluation>;
type CalculateWeightedScore = (scores: {
  requirementsMet: number;
  correctnessTests: number;
  codeQuality: number;
  problemSolving: number;
}) => Prisma.Decimal;
type CallEvaluatorModel = (input: EvaluationInput) => Promise<EvaluatorOutput>;

// --- Doc 8 §8.11 GitHub CI webhook ---
type VerifyGitHubWebhookSignature = (rawBody: Buffer, signatureHeader: string) => boolean;
type ProcessWorkflowRunWebhook = (event: GitHubWorkflowRunEvent) => Promise<void>;
type HandleSubmissionTimeout = (submissionId: string) => Promise<void>;

// --- Doc 8 §8.12 Experience profile ---
type GetExperienceProfile = (userId: string) => Promise<ProfileItem[]>;

describe('Doc 8 §8.5–8.12 domain type contracts', () => {
  it('reuses Prisma StarterTemplate rather than a duplicate string union', () => {
    expectTypeOf<StarterTemplate>().toEqualTypeOf<
      'react' | 'node_express' | 'django'
    >();
  });

  it('defines MentorHintStage as the four FR-38 stages', () => {
    expectTypeOf<MentorHintStage>().toEqualTypeOf<
      'ask_what_tried' | 'conceptual_hint' | 'point_to_file' | 'specific_suggestion'
    >();
  });

  it('type-checks §8.5 subscription signatures against domain types', () => {
    expectTypeOf<CreateCheckout>().toBeFunction();
    expectTypeOf<ProcessChapaWebhook>().parameter(0).toEqualTypeOf<ChapaWebhookPayload>();
    expectTypeOf<GetSubscriptionStatus>().returns.toEqualTypeOf<
      Promise<{ subscription: Subscription | null; hasAccess: boolean }>
    >();
    expectTypeOf<CancelSubscription>().toBeFunction();
    expectTypeOf<ListPayments>().toBeFunction();
    expectTypeOf<HasPaidAccess>().toBeFunction();
    expectTypeOf<ProcessUpcomingRenewals>().toBeFunction();
  });

  it('type-checks §8.6 GitHub signatures against domain types', () => {
    expectTypeOf<CreateGitHubAuthorizeUrl>().toBeFunction();
    expectTypeOf<HandleGitHubCallback>().toBeFunction();
    expectTypeOf<GetGitHubConnection>().returns.toEqualTypeOf<
      Promise<GitHubConnectionSummary>
    >();
    expectTypeOf<DisconnectGitHub>().toBeFunction();
    expectTypeOf<CreateStarterRepo>().parameter(1).toEqualTypeOf<StarterTemplate>();
    expectTypeOf<CreateTicketBranch>().toBeFunction();
    expectTypeOf<GetBranchSubmissionState>().returns.toEqualTypeOf<
      Promise<GitHubSubmissionState>
    >();
  });

  it('type-checks §8.7 ticket signatures against domain types', () => {
    expectTypeOf<LoadTicketTemplate>().returns.toEqualTypeOf<TicketTemplate>();
    expectTypeOf<SelectNextTicketTemplate>().returns.toEqualTypeOf<
      Promise<TicketTemplateSelection>
    >();
    expectTypeOf<GenerateTicketContent>().returns.toEqualTypeOf<Promise<TicketContent>>();
    expectTypeOf<AssignNextTicket>().toBeFunction();
    expectTypeOf<GetCurrentTicket>().toBeFunction();
    expectTypeOf<GetTicketById>().returns.toEqualTypeOf<Promise<TicketWithSubmissions>>();
    expectTypeOf<StartTicket>().toBeFunction();
    expectTypeOf<AbandonTicket>().toBeFunction();
  });

  it('type-checks §8.8 mentor signatures against domain types', () => {
    expectTypeOf<GetMentorHintStage>().returns.toEqualTypeOf<MentorHintStage>();
    expectTypeOf<SendMentorMessage>().toBeFunction();
    expectTypeOf<CallMentorModel>().parameter(0).toEqualTypeOf<MentorModelInput>();
    expectTypeOf<CanSendMentorMessage>().toBeFunction();
  });

  it('type-checks §8.9 submission signatures against domain types', () => {
    expectTypeOf<DetermineSubmissionAttempt>().returns.toEqualTypeOf<SubmissionAttempt>();
    expectTypeOf<SubmitWork>().toBeFunction();
    expectTypeOf<GetSubmission>().returns.toEqualTypeOf<Promise<SubmissionView>>();
    expectTypeOf<RetrySubmission>().toBeFunction();
  });

  it('type-checks §8.10 evaluation signatures against domain types', () => {
    expectTypeOf<BuildEvaluationInput>().returns.toEqualTypeOf<EvaluationInput>();
    expectTypeOf<EvaluateSubmission>().toBeFunction();
    expectTypeOf<CalculateWeightedScore>().toBeFunction();
    expectTypeOf<CallEvaluatorModel>().returns.toEqualTypeOf<Promise<EvaluatorOutput>>();
  });

  it('type-checks §8.11–8.12 webhook and profile signatures', () => {
    expectTypeOf<VerifyGitHubWebhookSignature>().toBeFunction();
    expectTypeOf<ProcessWorkflowRunWebhook>().parameter(0).toEqualTypeOf<GitHubWorkflowRunEvent>();
    expectTypeOf<HandleSubmissionTimeout>().toBeFunction();
    expectTypeOf<GetExperienceProfile>().returns.toEqualTypeOf<Promise<ProfileItem[]>>();
  });
});
