import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryClient } from '@/lib/queryClient';
import router from '@/routes';
import App from '@/App';
import type { Submission, Ticket, User } from '@/types';

const mockUser: User = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Test Engineer',
  email: 'engineer@worksim.test',
  role: 'developer',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const doneTicket: Ticket = {
  id: 'ticket-1', status: 'done', templateKey: 'react', title: 'Improve project search',
  scenario: 'Add filters.', category: 'Frontend', difficulty: 'Easy', touchedFiles: [],
  acceptanceCriteria: [], testChecklist: [], branchName: 'ticket/search',
  repo: { fullName: 'worksim-user/work-simulator', defaultBranch: 'main' },
  createdAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-04T00:00:00.000Z', abandonedAt: null,
};

const finalSubmission: Submission = {
  id: 'submission-2', attempt: 2, status: 'completed', prNumber: 13,
  prUrl: 'https://github.com/worksim-user/work-simulator/pull/13', headSha: 'b'.repeat(40),
  ciPassed: true, ciRunUrl: null, failureReason: null, submittedAt: '2026-01-03T00:00:00.000Z',
  evaluation: {
    feedback: 'The requested changes are complete.',
    scores: { requirementsMet: 90, correctnessTests: 80, codeQuality: 70, problemSolving: 60, total: 78 },
    createdAt: '2026-01-04T00:00:00.000Z',
  },
};

function response(status: number, data: unknown, message = 'OK'): Response {
  return new Response(
    JSON.stringify({ statusCode: status, success: status >= 200 && status < 300, message, data }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

function mockFetch(handler: (path: string, url: URL) => Response) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
    void init;
    const url = new URL(input instanceof Request ? input.url : String(input));
    return Promise.resolve(handler(url.pathname, url));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('Submission flow integration', () => {
  beforeEach(async () => {
    queryClient.clear();
    await act(async () => router.navigate('/tickets/ticket-1?tab=submissions'));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    queryClient.clear();
  });

  it('shows attempt one as feedback-only and never renders scores', async () => {
    const firstSubmission: Submission = {
      ...finalSubmission,
      id: 'submission-1', attempt: 1, status: 'completed',
      evaluation: { feedback: 'Add validation for empty input.', scores: null, createdAt: '2026-01-02T00:00:00.000Z' },
    };
    mockFetch((path) => {
      if (path.endsWith('/users/me')) return response(200, { user: mockUser });
      if (path.endsWith('/subscriptions/me')) return response(200, { subscription: null, hasAccess: true });
      if (path.endsWith('/tickets/ticket-1')) return response(200, { ticket: { ...doneTicket, status: 'submitted_v1' }, submissions: [firstSubmission] });
      if (path.endsWith('/tickets/ticket-1/submissions/1')) return response(200, { submission: firstSubmission });
      return response(200, null);
    });

    render(<App />);

    expect(await screen.findByText('Add validation for empty input.')).toBeInTheDocument();
    expect(screen.getByText('Not scored')).toBeInTheDocument();
    expect(screen.queryByText('78')).toBeNull();
  });

  it('shows attempt-two API scores and fetches the diff only when opened', async () => {
    let diffRequestCount = 0;
    mockFetch((path, url) => {
      if (path.endsWith('/users/me')) return response(200, { user: mockUser });
      if (path.endsWith('/subscriptions/me')) return response(200, { subscription: null, hasAccess: true });
      if (path.endsWith('/tickets/ticket-1')) return response(200, { ticket: doneTicket, submissions: [finalSubmission] });
      if (path.endsWith('/tickets/ticket-1/submissions/2')) {
        if (url.searchParams.get('includeDiff') === 'true') {
          diffRequestCount += 1;
          return response(200, { submission: { ...finalSubmission, diff: '@@\n+added behavior\n-removed behavior' } });
        }
        return response(200, { submission: finalSubmission });
      }
      return response(200, null);
    });

    render(<App />);

    expect(await screen.findByText('The requested changes are complete.')).toBeInTheDocument();
    expect(screen.getByText('78')).toBeInTheDocument();
    expect(diffRequestCount).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'View diff' }));

    expect(await screen.findByText('+added behavior')).toBeInTheDocument();
    expect(screen.getByText('-removed behavior')).toBeInTheDocument();
    expect(diffRequestCount).toBe(1);
  });
});