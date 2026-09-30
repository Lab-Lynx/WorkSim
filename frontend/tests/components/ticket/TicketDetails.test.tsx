import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TicketDetails from '@/components/ticket/TicketDetails';
import type { Ticket } from '@/types';

const ticket: Ticket = {
  id: 'ticket-1',
  status: 'assigned',
  templateKey: 'react',
  title: 'Improve settings validation',
  scenario: 'A settings page needs validation.\nKeep the existing API contract.',
  category: 'Frontend',
  difficulty: 'Intermediate',
  touchedFiles: ['src/pages/settings.tsx'],
  acceptanceCriteria: ['Validate the display name.'],
  testChecklist: ['Add a form test.'],
  branchName: 'feat/settings-validation',
  repo: { fullName: 'student/worksim', defaultBranch: 'main' },
  createdAt: '2026-09-01T00:00:00Z',
  completedAt: null,
  abandonedAt: null,
};

describe('TicketDetails (FE-092)', () => {
  it('renders scenario and read-only ticket lists', () => {
    render(<TicketDetails ticket={ticket} />);

    expect(screen.getByText(/A settings page needs validation\./)).toBeInTheDocument();
    expect(screen.getByText('src/pages/settings.tsx')).toBeInTheDocument();
    expect(screen.getByText('Validate the display name.')).toBeInTheDocument();
    expect(screen.getByText('Add a form test.')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('hides empty list sections', () => {
    render(<TicketDetails ticket={{ ...ticket, touchedFiles: [], acceptanceCriteria: [], testChecklist: [] }} />);

    expect(screen.queryByRole('heading', { name: /touched files/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /acceptance criteria/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /test checklist/i })).not.toBeInTheDocument();
  });

  it('renders API-provided scenario text without interpreting HTML', () => {
    render(<TicketDetails ticket={{ ...ticket, scenario: '<img src=x> do not execute' }} />);

    expect(screen.getByText('<img src=x> do not execute')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });
});