import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryClient } from '@/lib/queryClient';
import router from '@/routes';
import App from '@/App';
import type { Ticket, User } from '@/types';

const mockUser: User = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Test Engineer',
  email: 'engineer@worksim.test',
  role: 'developer',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const hostileText = '<img src=x onerror=alert(1)> Search results safely.';
const mockTicket: Ticket = {
  id: 'ticket-1', status: 'in_progress', templateKey: 'react', title: 'Improve project search',
  scenario: hostileText, category: 'Frontend', difficulty: 'Easy', touchedFiles: [],
  acceptanceCriteria: [], testChecklist: [], branchName: 'ticket/search',
  repo: { fullName: 'worksim-user/work-simulator', defaultBranch: 'main' },
  createdAt: '2026-01-01T00:00:00.000Z', completedAt: null, abandonedAt: null,
};

function response(status: number, data: unknown, message = 'OK'): Response {
  return new Response(
    JSON.stringify({ statusCode: status, success: status >= 200 && status < 300, message, data }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

function mockFetch() {
  const fetchMock = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname.endsWith('/users/me')) return Promise.resolve(response(200, { user: mockUser }));
    if (url.pathname.endsWith('/subscriptions/me')) {
      return Promise.resolve(response(200, { subscription: null, hasAccess: true }));
    }
    if (url.pathname.endsWith('/tickets/ticket-1')) {
      return Promise.resolve(response(200, { ticket: mockTicket, submissions: [] }));
    }
    if (init.credentials !== 'include') throw new Error('API request omitted cookie credentials');
    return Promise.resolve(response(200, null));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('Security and accessibility integration', () => {
  beforeEach(async () => {
    queryClient.clear();
    localStorage.clear();
    sessionStorage.clear();
    await act(async () => router.navigate('/tickets/ticket-1?tab=ticket'));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    queryClient.clear();
  });

  it('renders API text literally, exposes a focusable page heading, and keeps auth in cookies', async () => {
    const fetchMock = mockFetch();
    render(<App />);

    const heading = await screen.findByRole('heading', { name: 'Improve project search' });
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(screen.getByText(hostileText)).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    expect(fetchMock.mock.calls.every(([, init]) => init?.credentials === 'include')).toBe(true);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});