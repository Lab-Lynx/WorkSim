import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExperienceProfilePage from '@/pages/profile/ExperienceProfilePage';
import { useExperienceProfile } from '@/hooks/profile/useExperienceProfile';
import type { ProfileItem } from '@/types';

vi.mock('@/hooks/profile/useExperienceProfile');

const items: ProfileItem[] = [
  {
    ticketId: 'ticket-1', title: 'First completed ticket', category: 'Frontend', difficulty: 'Easy',
    completedAt: '2026-09-01T00:00:00Z',
    evaluation: { feedback: 'First feedback', scores: null, createdAt: '2026-09-01T00:00:00Z' },
  },
  {
    ticketId: 'ticket-2', title: 'Second completed ticket', category: 'Backend', difficulty: 'Medium',
    completedAt: '2026-09-02T00:00:00Z',
    evaluation: { feedback: 'Second feedback', scores: null, createdAt: '2026-09-02T00:00:00Z' },
  },
];

function renderPage() {
  return render(<MemoryRouter><ExperienceProfilePage /></MemoryRouter>);
}

describe('ExperienceProfilePage (FE-098)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('always renders the practice record notice while loading', () => {
    vi.mocked(useExperienceProfile).mockReturnValue({ isLoading: true, data: undefined } as never);
    renderPage();

    expect(screen.getByText(/not a certified or employer-verified credential/i)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /loading experience profile/i })).toBeInTheDocument();
  });

  it('keeps the notice visible for empty and error states', () => {
    vi.mocked(useExperienceProfile).mockReturnValue({ isLoading: false, data: [] } as never);
    const { rerender } = renderPage();

    expect(screen.getByText(/not a certified or employer-verified credential/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No completed tickets yet.' })).toBeInTheDocument();
    expect(screen.getByText('Finish your first ticket and it will appear here.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute('href', '/dashboard');

    vi.mocked(useExperienceProfile).mockReturnValue({
      isLoading: false,
      data: undefined,
      isError: true,
      error: new Error('Profile unavailable'),
      refetch: vi.fn(),
    } as never);
    rerender(<MemoryRouter><ExperienceProfilePage /></MemoryRouter>);
    expect(screen.getByText(/not a certified or employer-verified credential/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Profile unavailable');
  });

  it('renders count and items in the order returned by the server', () => {
    vi.mocked(useExperienceProfile).mockReturnValue({ isLoading: false, data: items } as never);
    renderPage();

    expect(screen.getByText('2 completed tickets')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      'First completed ticket',
      'Second completed ticket',
    ]);
  });

  it('uses singular wording for one completed ticket', () => {
    vi.mocked(useExperienceProfile).mockReturnValue({ isLoading: false, data: [items[0]] } as never);
    renderPage();
    expect(screen.getByText('1 completed ticket')).toBeInTheDocument();
  });
});