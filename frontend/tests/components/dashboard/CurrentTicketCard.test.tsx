import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import CurrentTicketCard from '@/components/dashboard/CurrentTicketCard';
import type { Ticket } from '@/types';

const ticket: Ticket = {
  id: 'ticket-123',
  status: 'in_progress',
  templateKey: 'react',
  title: 'Add settings validation',
  scenario: 'A profile page needs validation.',
  category: 'Frontend',
  difficulty: 'Intermediate',
  touchedFiles: [],
  acceptanceCriteria: [],
  testChecklist: [],
  branchName: 'feat/settings-validation',
  repo: { fullName: 'student/worksim', defaultBranch: 'main' },
  createdAt: '2026-09-01T00:00:00.000Z',
  completedAt: null,
  abandonedAt: null,
};

const defaultProps = {
  query: { status: 'success' as const, ticket: null, error: null, refetch: vi.fn() },
  canGetTicket: true,
  getBlockedReason: null,
  isGetting: false,
  getError: null,
  getErrorLink: null,
  onGetTicket: vi.fn(),
};

describe('CurrentTicketCard (FE-081)', () => {
  it('offers the only get-ticket action and disables it while pending', () => {
    render(
      <MemoryRouter>
        <CurrentTicketCard {...defaultProps} isGetting />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /getting your ticket/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /getting your ticket/i })).toHaveAttribute(
      'type',
      'button'
    );
  });

  it('shows a ticket with its coarse status and continue link', () => {
    render(
      <MemoryRouter>
        <CurrentTicketCard
          {...defaultProps}
          query={{ ...defaultProps.query, ticket }}
          canGetTicket={false}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(ticket.title)).toBeInTheDocument();
    expect(screen.getByText(ticket.category)).toBeInTheDocument();
    expect(screen.getByText(ticket.difficulty)).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /continue/i })).toHaveAttribute(
      'href',
      '/tickets/ticket-123'
    );
  });

  it('shows the setup block reason and inline action link', () => {
    render(
      <MemoryRouter>
        <CurrentTicketCard
          {...defaultProps}
          canGetTicket={false}
          getBlockedReason="Finish setup to get a ticket."
          getError={{
            status: 403,
            kind: 'api',
            message: 'Reconnect GitHub to continue.',
            action: 'reconnect_github',
            isNotFound: false,
            isTimeout: false,
          }}
          getErrorLink={{ to: '/github', label: 'Reconnect GitHub' }}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Finish setup to get a ticket.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Reconnect GitHub to continue.');
    expect(screen.getByRole('link', { name: 'Reconnect GitHub' })).toHaveAttribute(
      'href',
      '/github'
    );
  });

  it('retries a failed ticket query', () => {
    const refetch = vi.fn();
    render(
      <MemoryRouter>
        <CurrentTicketCard
          {...defaultProps}
          query={{
            status: 'error',
            ticket: undefined,
            error: {
              status: 500,
              kind: 'api',
              message: 'Ticket unavailable.',
              action: 'retry',
              isNotFound: false,
              isTimeout: false,
            },
            refetch,
          }}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});