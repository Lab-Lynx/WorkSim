import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryClient } from '@/lib/queryClient';
import router from '@/routes';
import App from '@/App';
import type { User } from '@/types';

const mockUser: User = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Test Engineer',
  email: 'engineer@worksim.test',
  role: 'developer',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
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

describe('Billing flow integration', () => {
  beforeEach(async () => {
    queryClient.clear();
    await act(async () => router.navigate('/billing/return'));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    queryClient.clear();
    vi.useRealTimers();
  });

  it('confirms access only after the API reports an active subscription', async () => {
    const fetchMock = mockFetch((path) => {
      if (path.endsWith('/users/me')) return response(200, { user: mockUser });
      if (path.endsWith('/subscriptions/me')) {
        return response(200, {
          subscription: {
            id: 'subscription-1',
            status: 'active',
            currentPeriodEnd: '2027-01-01T00:00:00.000Z',
            canceledAt: null,
          },
          hasAccess: true,
        });
      }
      return response(200, null);
    });

    render(<App />);

    expect(await screen.findByText('Subscription Confirmed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Connect GitHub' })).toHaveAttribute('href', '/github');
    expect(fetchMock.mock.calls.every(([, init]) => init?.credentials === 'include')).toBe(true);
  });

  it('shows a recovery state and never claims success when subscription lookup fails', async () => {
    mockFetch((path) => {
      if (path.endsWith('/users/me')) return response(200, { user: mockUser });
      if (path.endsWith('/subscriptions/me')) return response(400, null, 'Subscription unavailable');
      return response(200, null);
    });

    render(<App />);

    expect(await screen.findByText('Unable to Verify Subscription')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Connect GitHub' })).toHaveAttribute('href', '/github');
    expect(screen.queryByText('Subscription Confirmed')).toBeNull();
  });
});