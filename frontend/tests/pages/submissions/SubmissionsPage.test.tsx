import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SubmissionsPage from '@/pages/submissions/SubmissionsPage';
import { useSubmissions } from '@/hooks/submissions/useSubmissions';
import type { SubmissionListItem } from '@/types';

vi.mock('@/hooks/submissions/useSubmissions');
vi.mock('@/hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }));

const base: SubmissionListItem = {
  id: '22222222-2222-4222-8222-222222222221',
  attempt: 1,
  status: 'completed',
  prNumber: 7,
  prUrl: 'https://github.com/octo-org/work-sim/pull/7',
  headSha: 'sha-1',
  ciPassed: true,
  ciRunUrl: null,
  failureReason: null,
  submittedAt: '2026-09-29T10:00:00.000Z',
  evaluation: {
    feedback: 'Clean fix with good tests.',
    scores: { total: 82 } as never,
    createdAt: '2026-09-29T10:05:00.000Z',
  },
  ticket: {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Fix cart quantity',
    category: 'Bug fix',
    branchName: 'ticket/cart',
  },
  baseBranch: 'main',
};

function mockQuery(value: Record<string, unknown>) {
  vi.mocked(useSubmissions).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...value,
  } as never);
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SubmissionsPage />
    </MemoryRouter>,
  );
}

describe('SubmissionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a loading status while submissions load', () => {
    mockQuery({ isLoading: true });
    renderPage();
    expect(screen.getByRole('status', { name: 'Loading submissions' })).toBeInTheDocument();
  });

  it('shows an empty state with a link to the dashboard', () => {
    mockQuery({ data: [] });
    renderPage();
    expect(screen.getByText('No submissions yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  it('shows a friendly error and retries on request', () => {
    const refetch = vi.fn();
    mockQuery({ isError: true, error: { status: 500, kind: 'api', message: 'boom' }, refetch });
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('We could not load your submissions.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it('renders submissions with score and feedback', () => {
    mockQuery({ data: [base] });
    renderPage();
    expect(screen.getByText('Bug fix')).toBeInTheDocument();
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('Clean fix with good tests.')).toBeInTheDocument();
  });

  it('shows the failure reason and pending feedback for a failed submission', () => {
    mockQuery({
      data: [{ ...base, status: 'failed', ciPassed: false, failureReason: 'Tests failed', evaluation: null }],
    });
    renderPage();
    expect(screen.getByText('Tests failed')).toBeInTheDocument();
    expect(screen.getByText('Feedback will appear once evaluation finishes.')).toBeInTheDocument();
  });

  it('explains hidden scores', () => {
    mockQuery({
      data: [{ ...base, evaluation: { ...base.evaluation!, scores: null } }],
    });
    renderPage();
    expect(screen.getByText('Scores hidden')).toBeInTheDocument();
  });
});
