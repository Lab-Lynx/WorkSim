/* eslint-disable react-refresh/only-export-components */
import * as React from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Circle,
  Ban,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PaymentStatus, TicketStatus, SubmissionStatus } from '@/types';

export type SubscriptionViewKind =
  | 'never'
  | 'active'
  | 'renewal_pending'
  | 'past_due_access'
  | 'past_due_ended'
  | 'canceled_access'
  | 'ended'
  | 'unknown';

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

export type StatusBadgeProps =
  | { domain: 'subscription'; kind: SubscriptionViewKind | (string & {}); className?: string }
  | { domain: 'payment'; status: PaymentStatus | (string & {}); className?: string }
  | { domain: 'ticket_phase'; phase: TicketPhaseKey | (string & {}); className?: string }
  | { domain: 'ticket_status'; status: TicketStatus | (string & {}); className?: string }
  | { domain: 'submission'; status: SubmissionStatus | (string & {}); className?: string }
  | { domain: 'ci'; passed: boolean | null | (string & {}); className?: string }
  | { domain: 'verification'; verified: boolean | (string & {}); className?: string };

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

interface StatusDetails {
  label: string;
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  variantClass: string;
}

function getDetails(props: StatusBadgeProps): StatusDetails {
  switch (props.domain) {
    case 'subscription': {
      switch (props.kind) {
        case 'never':
          return {
            label: 'Not subscribed',
            Icon: Circle,
            variantClass: 'bg-muted text-muted-foreground border-border',
          };
        case 'active':
          return {
            label: 'Active',
            Icon: CheckCircle2,
            variantClass: 'bg-primary/15 text-primary border-primary/20',
          };
        case 'renewal_pending':
          return {
            label: 'Renewal pending',
            Icon: Clock,
            variantClass:
              'bg-status-in-progress-bg text-status-in-progress-text border-transparent',
          };
        case 'past_due_access':
        case 'past_due_ended':
          return {
            label: 'Payment failed',
            Icon: AlertTriangle,
            variantClass: 'bg-destructive/10 text-destructive border-destructive/20',
          };
        case 'canceled_access':
          return {
            label: 'Canceled',
            Icon: Ban,
            variantClass: 'bg-muted text-muted-foreground border-border',
          };
        case 'ended':
          return {
            label: 'Ended',
            Icon: XCircle,
            variantClass: 'bg-muted text-muted-foreground border-border',
          };
        default:
          return {
            label: String(props.kind),
            Icon: AlertCircle,
            variantClass: 'bg-muted text-muted-foreground border-border',
          };
      }
    }

    case 'payment': {
      switch (props.status) {
        case 'pending':
          return {
            label: 'Pending',
            Icon: Clock,
            variantClass:
              'bg-status-in-progress-bg text-status-in-progress-text border-transparent',
          };
        case 'succeeded':
          return {
            label: 'Succeeded',
            Icon: CheckCircle2,
            variantClass: 'bg-primary/15 text-primary border-primary/20',
          };
        case 'failed':
          return {
            label: 'Failed',
            Icon: XCircle,
            variantClass: 'bg-destructive/10 text-destructive border-destructive/20',
          };
        default:
          return {
            label: String(props.status),
            Icon: AlertCircle,
            variantClass: 'bg-muted text-muted-foreground border-border',
          };
      }
    }

    case 'ticket_phase': {
      const knownLabel = TICKET_PHASE_LABELS[props.phase as TicketPhaseKey];
      if (knownLabel) {
        let Icon = Clock;
        let variantClass =
          'bg-status-in-progress-bg text-status-in-progress-text border-transparent';

        if (props.phase === 'ready_to_start') {
          Icon = Circle;
          variantClass = 'bg-muted text-muted-foreground border-border';
        } else if (props.phase === 'done') {
          Icon = CheckCircle2;
          variantClass = 'bg-primary/15 text-primary border-primary/20';
        } else if (props.phase === 'abandoned') {
          Icon = Ban;
          variantClass = 'bg-muted text-muted-foreground border-border';
        } else if (props.phase === 'first_review_failed' || props.phase === 'final_review_failed') {
          Icon = XCircle;
          variantClass = 'bg-destructive/10 text-destructive border-destructive/20';
        } else if (props.phase === 'feedback_ready') {
          Icon = CheckCircle2;
          variantClass = 'bg-primary/15 text-primary border-primary/20';
        }

        return { label: knownLabel, Icon, variantClass };
      }
      return {
        label: String(props.phase),
        Icon: AlertCircle,
        variantClass: 'bg-muted text-muted-foreground border-border',
      };
    }

    case 'ticket_status': {
      const label = getTicketStatusLabel(props.status);
      let Icon = Clock;
      let variantClass = 'bg-status-in-progress-bg text-status-in-progress-text border-transparent';

      if (props.status === 'assigned') {
        Icon = Circle;
        variantClass = 'bg-muted text-muted-foreground border-border';
      } else if (props.status === 'done') {
        Icon = CheckCircle2;
        variantClass = 'bg-primary/15 text-primary border-primary/20';
      } else if (props.status === 'abandoned') {
        Icon = Ban;
        variantClass = 'bg-muted text-muted-foreground border-border';
      } else if (label === String(props.status)) {
        Icon = AlertCircle;
        variantClass = 'bg-muted text-muted-foreground border-border';
      }

      return { label, Icon, variantClass };
    }

    case 'submission': {
      switch (props.status) {
        case 'awaiting_ci':
          return {
            label: 'Waiting for tests',
            Icon: Clock,
            variantClass:
              'bg-status-in-progress-bg text-status-in-progress-text border-transparent',
          };
        case 'evaluating':
          return {
            label: 'Evaluating',
            Icon: Clock,
            variantClass:
              'bg-status-in-progress-bg text-status-in-progress-text border-transparent',
          };
        case 'completed':
          return {
            label: 'Completed',
            Icon: CheckCircle2,
            variantClass: 'bg-primary/15 text-primary border-primary/20',
          };
        case 'failed':
          return {
            label: 'Failed',
            Icon: XCircle,
            variantClass: 'bg-destructive/10 text-destructive border-destructive/20',
          };
        default:
          return {
            label: String(props.status),
            Icon: AlertCircle,
            variantClass: 'bg-muted text-muted-foreground border-border',
          };
      }
    }

    case 'ci': {
      if (props.passed === true) {
        return {
          label: 'Tests passed',
          Icon: CheckCircle2,
          variantClass: 'bg-primary/15 text-primary border-primary/20',
        };
      }
      if (props.passed === false) {
        return {
          label: 'Tests failed',
          Icon: XCircle,
          variantClass: 'bg-destructive/10 text-destructive border-destructive/20',
        };
      }
      if (props.passed === null) {
        return {
          label: 'Tests pending',
          Icon: Clock,
          variantClass: 'bg-status-in-progress-bg text-status-in-progress-text border-transparent',
        };
      }
      return {
        label: String(props.passed),
        Icon: AlertCircle,
        variantClass: 'bg-muted text-muted-foreground border-border',
      };
    }

    case 'verification': {
      if (props.verified === true) {
        return {
          label: 'Verified',
          Icon: CheckCircle2,
          variantClass: 'bg-primary/15 text-primary border-primary/20',
        };
      }
      if (props.verified === false) {
        return {
          label: 'Not verified',
          Icon: XCircle,
          variantClass: 'bg-destructive/10 text-destructive border-destructive/20',
        };
      }
      return {
        label: String(props.verified),
        Icon: AlertCircle,
        variantClass: 'bg-muted text-muted-foreground border-border',
      };
    }
  }
}

export default function StatusBadge(props: StatusBadgeProps): React.JSX.Element {
  const { label, Icon, variantClass } = getDetails(props);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors',
        variantClass,
        props.className
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
