import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TicketHeader from '@/components/ticket/TicketHeader';
import type { Ticket } from '@/types';
import type { TicketPhaseInfo } from '@/lib/ticket-phase';

const ticket: Ticket = {
  id: 'ticket-1', status: 'in_progress', templateKey: 'react', title: 'Improve settings validation',
  scenario: 'Scenario', category: 'Frontend', difficulty: 'Intermediate', touchedFiles: [],
  acceptanceCriteria: [], testChecklist: [], branchName: 'feat/settings',
  repo: { fullName: 'student/worksim', defaultBranch: 'main' }, createdAt: '2026-09-01T00:00:00Z',
  completedAt: null, abandonedAt: null,
};
const phase: TicketPhaseInfo = {
  key: 'in_progress', label: 'In progress', primaryAction: 'submit', retryAttempt: null,
  mentor: 'enabled', canAbandon: true, isProcessing: false, defaultTab: 'ticket',
};

describe('TicketHeader (FE-093)', () => {
  it('renders a focusable ticket title, phase status, category, and difficulty', () => {
    render(<TicketHeader ticket={ticket} phase={phase} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Improve settings validation' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Frontend')).toBeInTheDocument();
    expect(screen.getByText('Intermediate')).toBeInTheDocument();
  });
});