import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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

function ticket(status: Ticket['status']): Ticket {
  return {
    id: 'ticket-1', status, templateKey: 'react', title: 'Improve project search',
    scenario: 'Add filters.', category: 'Frontend', difficulty: 'Easy', touchedFiles: [],
    acceptanceCriteria: [], testChecklist: [], branchName: 'ticket/search',
    repo: { fullName: 'worksim-user/work-simulator', defaultBranch: 'main' },
    createdAt: '2026-01-01T00:00:00.000Z', completedAt: null, abandonedAt: null,
  };
}

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

describe('Mentor flow integration', () => {
  beforeEach(async () => {
    queryClient.clear();
    await act(async () => router.navigate('/tickets/ticket-1?tab=mentor'));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    queryClient.clear();
  });

  it('sends one message and renders mentor content as literal text', async () => {
    const maliciousText = '<script>window.compromised = true</script>';
    const sentText = '<img src=x onerror=alert(1)>';
    let sendCount = 0;
    let sentBody: unknown;
    mockFetch((path, init) => {
      if (path.endsWith('/users/me')) return response(200, { user: mockUser });
      if (path.endsWith('/subscriptions/me')) return response(200, { subscription: null, hasAccess: true });
      if (path.endsWith('/tickets/ticket-1')) return response(200, { ticket: ticket('in_progress'), submissions: [] });
      if (path.endsWith('/tickets/ticket-1/mentor/messages') && init.method === 'GET') {
        return response(200, { messages: [{ id: 'm1', role: 'mentor', content: maliciousText, createdAt: '2026-01-02T00:00:00.000Z' }] });
      }
      if (path.endsWith('/tickets/ticket-1/mentor/messages')) {
        sendCount += 1;
        sentBody = JSON.parse(String(init.body));
        return response(201, {
          userMessage: { id: 'm2', role: 'user', content: sentText, createdAt: '2026-01-03T00:00:00.000Z' },
          mentorMessage: { id: 'm3', role: 'mentor', content: 'Try checking the filter predicate.', createdAt: '2026-01-03T00:00:01.000Z' },
        });
      }
      return response(200, null);
    });

    render(<App />);
    expect(await screen.findByText(maliciousText)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Message to the mentor'), { target: { value: sentText } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Try checking the filter predicate.')).toBeInTheDocument();
    expect(screen.getByText(sentText)).toBeInTheDocument();
    expect(document.querySelector('script, img')).toBeNull();
    expect(sendCount).toBe(1);
    expect(sentBody).toEqual({ content: sentText });
  });

  it('does not expose a composer once the ticket is complete', async () => {
    mockFetch((path) => {
      if (path.endsWith('/users/me')) return response(200, { user: mockUser });
      if (path.endsWith('/subscriptions/me')) return response(200, { subscription: null, hasAccess: true });
      if (path.endsWith('/tickets/ticket-1')) return response(200, { ticket: ticket('done'), submissions: [] });
      if (path.endsWith('/tickets/ticket-1/mentor/messages')) return response(200, { messages: [] });
      return response(200, null);
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Mentor' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Message to the mentor')).toBeNull();
  });
});