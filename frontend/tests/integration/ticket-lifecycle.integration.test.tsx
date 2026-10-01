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

const initialTicket: Ticket = {
  id: 'ticket-1',
  status: 'assigned',
  templateKey: 'react',
  title: 'Improve project search',
  scenario: 'Add useful filters to project search.',
  category: 'Frontend',
  difficulty: 'Easy',
  touchedFiles: ['src/search.ts'],
  acceptanceCriteria: ['Filters update the results.'],
  testChecklist: ['Search filters are covered.'],
  branchName: 'ticket/project-search',
  repo: { fullName: 'worksim-user/work-simulator', defaultBranch: 'main' },
  createdAt: '2026-01-01T00:00:00.000Z',
  completedAt: null,
  abandonedAt: null,
};

function response(status: number, data: unknown, message = 'OK'): Response {
  return new Response(
    JSON.stringify({ statusCode: status, success: status >= 200 && status < 300, message, data }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

function mockFetch(handler: (path: string, init: RequestInit) => Response) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = input instanceof Request ? input.url : String(input);
    return Promise.resolve(handler(new URL(url).pathname, init));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('Ticket lifecycle integration', () => {
  beforeEach(async () => {
    queryClient.clear();
    await act(async () => router.navigate('/tickets/ticket-1'));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    queryClient.clear();
  });

  it('starts an assigned ticket and submits exactly the first attempt', async () => {
    let currentTicket = initialTicket;
    let submission: Submission | null = null;
    let submitCount = 0;
    mockFetch((path) => {
      if (path.endsWith('/users/me')) return response(200, { user: mockUser });
      if (path.endsWith('/subscriptions/me')) {
        return response(200, {
          subscription: { id: 'sub-1', status: 'active', currentPeriodEnd: '2027-01-01T00:00:00.000Z', canceledAt: null },
          hasAccess: true,
        });
      }
      if (path === '/api/v1/tickets/ticket-1') {
        return response(200, { ticket: currentTicket, submissions: submission ? [submission] : [] });
      }
      if (path.endsWith('/tickets/ticket-1/start')) {
        currentTicket = { ...currentTicket, status: 'in_progress' };
        return response(200, { ticket: currentTicket });
      }
      if (path.endsWith('/tickets/ticket-1/submissions')) {
        submitCount += 1;
        currentTicket = { ...currentTicket, status: 'submitted_v1' };
        submission = {
          id: 'submission-1',
          attempt: 1,
          status: 'awaiting_ci',
          prNumber: 12,
          prUrl: 'https://github.com/worksim-user/work-simulator/pull/12',
          headSha: 'a'.repeat(40),
          ciPassed: null,
          ciRunUrl: null,
          failureReason: null,
          submittedAt: '2026-01-02T00:00:00.000Z',
          evaluation: null,
        };
        return response(201, { submission });
      }
      return response(200, null);
    });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start working' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Submit for feedback' }));

    expect(await screen.findByText('Waiting for GitHub Actions to run your tests.')).toBeInTheDocument();
    expect(screen.getByText(/Attempt 1 — First review: feedback only, not scored/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Get next ticket' })).toBeNull();
    expect(submitCount).toBe(1);
    expect(currentTicket.status).toBe('submitted_v1');
  });

  it('uses the same not-found view for an unavailable ticket', async () => {
    mockFetch((path) => {
      if (path.endsWith('/users/me')) return response(200, { user: mockUser });
      if (path.endsWith('/subscriptions/me')) return response(200, { subscription: null, hasAccess: true });
      if (path.endsWith('/tickets/missing-ticket')) return response(404, null, 'Ticket belongs to another user');
      return response(200, null);
    });

    await act(async () => router.navigate('/tickets/missing-ticket'));
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Ticket not found' })).toBeInTheDocument();
    expect(screen.getByText('This ticket is unavailable.')).toBeInTheDocument();
    expect(screen.queryByText(/belongs to another user/i)).toBeNull();
  });
});