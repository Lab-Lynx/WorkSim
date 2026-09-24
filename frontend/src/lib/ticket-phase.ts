import type { Submission, SubmissionAttempt, Ticket, TicketStatus } from '@/types';

export type TicketPhaseKey =
  | 'ready_to_start'
  | 'in_progress'
  | 'first_review_processing'
  | 'feedback_ready'
  | 'first_review_failed'
  | 'final_review_processing'
  | 'final_review_failed'
  | 'final_review_finalizing'
  | 'done'
  | 'abandoned';

export type TicketPrimaryAction = 'start' | 'submit' | 'resubmit' | 'retry' | 'get_next';

export type MentorAvailability =
  | 'not_started'
  | 'enabled'
  | 'unavailable_after_submit'
  | 'read_only';

export type TicketTab = 'ticket' | 'mentor' | 'submissions';

export interface TicketPhaseInfo {
  key: TicketPhaseKey;
  label: string;
  primaryAction: TicketPrimaryAction | null;
  retryAttempt: SubmissionAttempt | null;
  mentor: MentorAvailability;
  canAbandon: boolean;
  isProcessing: boolean;
  defaultTab: TicketTab;
}

export const TICKET_PHASE_LABELS: Record<TicketPhaseKey, string> = {
  ready_to_start: 'Ready to start',
  in_progress: 'In progress',
  first_review_processing: 'First review in progress',
  feedback_ready: 'Feedback ready',
  first_review_failed: 'Review failed',
  final_review_processing: 'Final review in progress',
  final_review_failed: 'Final review failed',
  final_review_finalizing: 'Finalizing',
  done: 'Done',
  abandoned: 'Abandoned',
};

/**
 * Coarse label for places that only have the ticket, not its submissions (e.g., dashboard card).
 * Never used on TicketPage, which uses getTicketPhase.
 */
export function getTicketStatusLabel(status: TicketStatus | string): string {
  switch (status) {
    case 'assigned':
      return 'Ready to start';
    case 'in_progress':
      return 'In progress';
    case 'submitted_v1':
      return 'First review';
    case 'resubmitted':
      return 'Final review';
    case 'done':
      return 'Done';
    case 'abandoned':
      return 'Abandoned';
    default:
      return String(status);
  }
}

/**
 * Decides everything the ticket workspace shows and allows, from ticket.status plus latest submission status.
 * Encodes the Doc 6 PG-10 phase table and D-04 mentor availability:
 * - D-04: Mentor is available in 'in_progress' and 'feedback_ready' (submitted_v1).
 * - Never throws: missing expected submission returns matching *_processing phase;
 *   unknown status returns in_progress-safe defaults with mentor read-only.
 */
export function getTicketPhase(
  ticket: Ticket,
  submissions: Submission[]
): TicketPhaseInfo {
  if (!ticket || !ticket.status) {
    return {
      key: 'in_progress',
      label: TICKET_PHASE_LABELS.in_progress,
      primaryAction: null,
      retryAttempt: null,
      mentor: 'read_only',
      canAbandon: false,
      isProcessing: false,
      defaultTab: 'ticket',
    };
  }

  const safeSubmissions = Array.isArray(submissions) ? submissions : [];

  switch (ticket.status) {
    case 'assigned':
      return {
        key: 'ready_to_start',
        label: TICKET_PHASE_LABELS.ready_to_start,
        primaryAction: 'start',
        retryAttempt: null,
        mentor: 'not_started',
        canAbandon: true,
        isProcessing: false,
        defaultTab: 'ticket',
      };

    case 'in_progress':
      return {
        key: 'in_progress',
        label: TICKET_PHASE_LABELS.in_progress,
        primaryAction: 'submit',
        retryAttempt: null,
        mentor: 'enabled',
        canAbandon: true,
        isProcessing: false,
        defaultTab: 'ticket',
      };

    case 'submitted_v1': {
      const sub1 = safeSubmissions.find((s) => s.attempt === 1);
      if (sub1?.status === 'completed') {
        return {
          key: 'feedback_ready',
          label: TICKET_PHASE_LABELS.feedback_ready,
          primaryAction: 'resubmit',
          retryAttempt: null,
          mentor: 'enabled',
          canAbandon: false,
          isProcessing: false,
          defaultTab: 'submissions',
        };
      }
      if (sub1?.status === 'failed') {
        return {
          key: 'first_review_failed',
          label: TICKET_PHASE_LABELS.first_review_failed,
          primaryAction: 'retry',
          retryAttempt: 1,
          mentor: 'unavailable_after_submit',
          canAbandon: false,
          isProcessing: false,
          defaultTab: 'submissions',
        };
      }
      return {
        key: 'first_review_processing',
        label: TICKET_PHASE_LABELS.first_review_processing,
        primaryAction: null,
        retryAttempt: null,
        mentor: 'unavailable_after_submit',
        canAbandon: false,
        isProcessing: true,
        defaultTab: 'submissions',
      };
    }

    case 'resubmitted': {
      const sub2 = safeSubmissions.find((s) => s.attempt === 2);
      if (sub2?.status === 'completed') {
        return {
          key: 'final_review_finalizing',
          label: TICKET_PHASE_LABELS.final_review_finalizing,
          primaryAction: null,
          retryAttempt: null,
          mentor: 'unavailable_after_submit',
          canAbandon: false,
          isProcessing: false,
          defaultTab: 'submissions',
        };
      }
      if (sub2?.status === 'failed') {
        return {
          key: 'final_review_failed',
          label: TICKET_PHASE_LABELS.final_review_failed,
          primaryAction: 'retry',
          retryAttempt: 2,
          mentor: 'unavailable_after_submit',
          canAbandon: false,
          isProcessing: false,
          defaultTab: 'submissions',
        };
      }
      return {
        key: 'final_review_processing',
        label: TICKET_PHASE_LABELS.final_review_processing,
        primaryAction: null,
        retryAttempt: null,
        mentor: 'unavailable_after_submit',
        canAbandon: false,
        isProcessing: true,
        defaultTab: 'submissions',
      };
    }

    case 'done':
      return {
        key: 'done',
        label: TICKET_PHASE_LABELS.done,
        primaryAction: 'get_next',
        retryAttempt: null,
        mentor: 'read_only',
        canAbandon: false,
        isProcessing: false,
        defaultTab: 'submissions',
      };

    case 'abandoned':
      return {
        key: 'abandoned',
        label: TICKET_PHASE_LABELS.abandoned,
        primaryAction: null,
        retryAttempt: null,
        mentor: 'read_only',
        canAbandon: false,
        isProcessing: false,
        defaultTab: 'ticket',
      };

    default:
      return {
        key: 'in_progress',
        label: TICKET_PHASE_LABELS.in_progress,
        primaryAction: null,
        retryAttempt: null,
        mentor: 'read_only',
        canAbandon: false,
        isProcessing: false,
        defaultTab: 'ticket',
      };
  }
}
