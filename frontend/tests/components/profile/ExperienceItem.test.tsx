import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ExperienceItem from '@/components/profile/ExperienceItem';
import type { ProfileItem } from '@/types';

const item: ProfileItem = {
  ticketId: 'ticket-123',
  title: 'Improve settings validation',
  category: 'Frontend',
  difficulty: 'Intermediate',
  completedAt: '2026-09-01T00:00:00Z',
  evaluation: {
    feedback: 'A long feedback note that explains the submitted work and its edge cases in detail.',
    scores: { requirementsMet: 90, correctnessTests: 80, codeQuality: 85, problemSolving: 70, total: 83 },
    createdAt: '2026-09-01T00:00:00Z',
  },
};

describe('ExperienceItem (FE-097)', () => {
  it('renders ticket metadata, final score breakdown, and feedback history link', () => {
    render(<MemoryRouter><ExperienceItem item={item} /></MemoryRouter>);

    expect(screen.getByText(item.title)).toBeInTheDocument();
    expect(screen.getByText(item.category)).toBeInTheDocument();
    expect(screen.getByText(item.difficulty)).toBeInTheDocument();
    expect(screen.getByText('Score Breakdown')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /see feedback history and diff/i })).toHaveAttribute(
      'href',
      '/tickets/ticket-123?tab=submissions'
    );
    expect(screen.queryByRole('button', { name: /share/i })).not.toBeInTheDocument();
  });

  it('shows a safe fallback when evaluation scores are unavailable', () => {
    render(<MemoryRouter><ExperienceItem item={{ ...item, evaluation: { ...item.evaluation, scores: null } }} /></MemoryRouter>);

    expect(screen.getByText('Score unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Score Breakdown')).not.toBeInTheDocument();
  });

  it('clamps feedback with an accessible show-full toggle and renders it as text', () => {
    const longFeedback = '<img src=x> '.repeat(20);
    render(
      <MemoryRouter>
        <ExperienceItem item={{ ...item, evaluation: { ...item.evaluation, feedback: longFeedback } }} />
      </MemoryRouter>
    );

    const toggle = screen.getByRole('button', { name: 'Show full feedback' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Show less feedback' })).toHaveAttribute('aria-expanded', 'true');
    expect(document.querySelector('img')).toBeNull();
  });
});