import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import TicketActionBar from '@/components/ticket/TicketActionBar';
import type { TicketPhaseInfo } from '@/lib/ticket-phase';
import type { UiError } from '@/lib/api/errors';

const phase: TicketPhaseInfo = {
  key: 'in_progress', label: 'In progress', primaryAction: 'submit', retryAttempt: null,
  mentor: 'enabled', canAbandon: true, isProcessing: false, defaultTab: 'ticket',
};

describe('TicketActionBar (FE-094)', () => {
  it('delegates the phase primary action without owning a mutation', () => {
    const onAction = vi.fn();
    render(<MemoryRouter><TicketActionBar phase={phase} hasAccess onAction={onAction} pendingAction={null} error={null} /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /submit for feedback/i }));
    expect(onAction).toHaveBeenCalledWith('submit');
  });

  it('shows processing status without a button', () => {
    render(
      <MemoryRouter>
        <TicketActionBar
          phase={{ ...phase, key: 'first_review_processing', primaryAction: null, isProcessing: true }}
          hasAccess
          onAction={vi.fn()}
          pendingAction={null}
          error={null}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('enables the action without requiring an active subscription', () => {
    render(<MemoryRouter><TicketActionBar phase={phase} hasAccess={false} onAction={vi.fn()} pendingAction={null} error={null} /></MemoryRouter>);

    expect(screen.getByRole('button', { name: /submit for feedback/i })).toBeEnabled();
    expect(screen.queryByText('An active subscription is required.')).not.toBeInTheDocument();
  });

  it('renders API guidance links for action errors', () => {
    const error: UiError = {
      status: 403,
      kind: 'api',
      message: 'Reconnect GitHub to continue.',
      action: 'reconnect_github',
      isNotFound: false,
      isTimeout: false,
    };
    render(<MemoryRouter><TicketActionBar phase={phase} hasAccess onAction={vi.fn()} pendingAction={null} error={error} /></MemoryRouter>);

    expect(screen.getByRole('alert')).toHaveTextContent(error.message);
    expect(screen.getByRole('link', { name: 'Reconnect GitHub' })).toHaveAttribute('href', '/github');
  });
});