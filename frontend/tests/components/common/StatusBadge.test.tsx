import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StatusBadge from '@/components/common/StatusBadge';

describe('StatusBadge', () => {
  describe('Subscription domain', () => {
    it('renders correct labels for known subscription kinds', () => {
      const { rerender } = render(<StatusBadge domain="subscription" kind="active" />);
      expect(screen.getByText('Active')).toBeInTheDocument();

      rerender(<StatusBadge domain="subscription" kind="never" />);
      expect(screen.getByText('Not subscribed')).toBeInTheDocument();

      rerender(<StatusBadge domain="subscription" kind="renewal_pending" />);
      expect(screen.getByText('Renewal pending')).toBeInTheDocument();

      rerender(<StatusBadge domain="subscription" kind="past_due_access" />);
      expect(screen.getByText('Payment failed')).toBeInTheDocument();

      rerender(<StatusBadge domain="subscription" kind="past_due_ended" />);
      expect(screen.getByText('Payment failed')).toBeInTheDocument();

      rerender(<StatusBadge domain="subscription" kind="canceled_access" />);
      expect(screen.getByText('Canceled')).toBeInTheDocument();

      rerender(<StatusBadge domain="subscription" kind="ended" />);
      expect(screen.getByText('Ended')).toBeInTheDocument();
    });

    it('renders raw text and does not throw for unknown subscription kind', () => {
      render(<StatusBadge domain="subscription" kind="custom_plan_kind" />);
      expect(screen.getByText('custom_plan_kind')).toBeInTheDocument();
    });
  });

  describe('Payment domain', () => {
    it('renders correct labels for payment statuses', () => {
      const { rerender } = render(<StatusBadge domain="payment" status="pending" />);
      expect(screen.getByText('Pending')).toBeInTheDocument();

      rerender(<StatusBadge domain="payment" status="succeeded" />);
      expect(screen.getByText('Succeeded')).toBeInTheDocument();

      rerender(<StatusBadge domain="payment" status="failed" />);
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('renders raw text for unknown payment status', () => {
      render(<StatusBadge domain="payment" status="REFUNDED_PARTIAL" />);
      expect(screen.getByText('REFUNDED_PARTIAL')).toBeInTheDocument();
    });
  });

  describe('Ticket Phase domain', () => {
    it('renders correct labels for ticket phase keys', () => {
      const { rerender } = render(<StatusBadge domain="ticket_phase" phase="ready_to_start" />);
      expect(screen.getByText('Ready to start')).toBeInTheDocument();

      rerender(<StatusBadge domain="ticket_phase" phase="in_progress" />);
      expect(screen.getByText('In progress')).toBeInTheDocument();

      rerender(<StatusBadge domain="ticket_phase" phase="first_review_processing" />);
      expect(screen.getByText('First review in progress')).toBeInTheDocument();

      rerender(<StatusBadge domain="ticket_phase" phase="feedback_ready" />);
      expect(screen.getByText('Feedback ready')).toBeInTheDocument();

      rerender(<StatusBadge domain="ticket_phase" phase="first_review_failed" />);
      expect(screen.getByText('Review failed')).toBeInTheDocument();

      rerender(<StatusBadge domain="ticket_phase" phase="final_review_processing" />);
      expect(screen.getByText('Final review in progress')).toBeInTheDocument();

      rerender(<StatusBadge domain="ticket_phase" phase="final_review_failed" />);
      expect(screen.getByText('Final review failed')).toBeInTheDocument();

      rerender(<StatusBadge domain="ticket_phase" phase="final_review_finalizing" />);
      expect(screen.getByText('Finalizing')).toBeInTheDocument();

      rerender(<StatusBadge domain="ticket_phase" phase="done" />);
      expect(screen.getByText('Done')).toBeInTheDocument();

      rerender(<StatusBadge domain="ticket_phase" phase="abandoned" />);
      expect(screen.getByText('Abandoned')).toBeInTheDocument();
    });

    it('renders raw text for unknown ticket phase', () => {
      render(<StatusBadge domain="ticket_phase" phase="UNKNOWN_TICKET_PHASE" />);
      expect(screen.getByText('UNKNOWN_TICKET_PHASE')).toBeInTheDocument();
    });
  });

  describe('Ticket Status domain', () => {
    it('renders correct labels for ticket statuses', () => {
      const { rerender } = render(<StatusBadge domain="ticket_status" status="assigned" />);
      expect(screen.getByText('Ready to start')).toBeInTheDocument();

      rerender(<StatusBadge domain="ticket_status" status="in_progress" />);
      expect(screen.getByText('In progress')).toBeInTheDocument();

      rerender(<StatusBadge domain="ticket_status" status="submitted_v1" />);
      expect(screen.getByText('First review')).toBeInTheDocument();

      rerender(<StatusBadge domain="ticket_status" status="resubmitted" />);
      expect(screen.getByText('Final review')).toBeInTheDocument();

      rerender(<StatusBadge domain="ticket_status" status="done" />);
      expect(screen.getByText('Done')).toBeInTheDocument();

      rerender(<StatusBadge domain="ticket_status" status="abandoned" />);
      expect(screen.getByText('Abandoned')).toBeInTheDocument();
    });

    it('renders raw text for unknown ticket status', () => {
      render(<StatusBadge domain="ticket_status" status="custom_ticket_state" />);
      expect(screen.getByText('custom_ticket_state')).toBeInTheDocument();
    });
  });

  describe('Submission domain', () => {
    it('renders correct labels for submission statuses', () => {
      const { rerender } = render(<StatusBadge domain="submission" status="awaiting_ci" />);
      expect(screen.getByText('Waiting for tests')).toBeInTheDocument();

      rerender(<StatusBadge domain="submission" status="evaluating" />);
      expect(screen.getByText('Evaluating')).toBeInTheDocument();

      rerender(<StatusBadge domain="submission" status="completed" />);
      expect(screen.getByText('Completed')).toBeInTheDocument();

      rerender(<StatusBadge domain="submission" status="failed" />);
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('renders raw text for unknown submission status', () => {
      render(<StatusBadge domain="submission" status="MANUAL_REVIEW" />);
      expect(screen.getByText('MANUAL_REVIEW')).toBeInTheDocument();
    });
  });

  describe('CI domain', () => {
    it('renders correct labels for CI passed states', () => {
      const { rerender } = render(<StatusBadge domain="ci" passed={true} />);
      expect(screen.getByText('Tests passed')).toBeInTheDocument();

      rerender(<StatusBadge domain="ci" passed={false} />);
      expect(screen.getByText('Tests failed')).toBeInTheDocument();

      rerender(<StatusBadge domain="ci" passed={null} />);
      expect(screen.getByText('Tests pending')).toBeInTheDocument();
    });

    it('renders raw text for unknown string CI passed state', () => {
      render(<StatusBadge domain="ci" passed={'RUNNING_ACTION' as unknown as boolean} />);
      expect(screen.getByText('RUNNING_ACTION')).toBeInTheDocument();
    });
  });

  describe('Verification domain', () => {
    it('renders correct labels for verification states', () => {
      const { rerender } = render(<StatusBadge domain="verification" verified={true} />);
      expect(screen.getByText('Verified')).toBeInTheDocument();

      rerender(<StatusBadge domain="verification" verified={false} />);
      expect(screen.getByText('Not verified')).toBeInTheDocument();
    });

    it('renders raw text for unknown string verification state', () => {
      render(
        <StatusBadge
          domain="verification"
          verified={'PENDING_VERIFICATION' as unknown as boolean}
        />
      );
      expect(screen.getByText('PENDING_VERIFICATION')).toBeInTheDocument();
    });
  });

  describe('Accessibility & Icon handling', () => {
    it('renders decorative icons with aria-hidden="true" so text carries semantic meaning', () => {
      const { container } = render(<StatusBadge domain="ci" passed={true} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
