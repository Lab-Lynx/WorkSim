import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryClient } from '@/lib/queryClient';
import { apiRequest, resetSessionExpiredGuard } from '@/lib/api/client';
import { queryKeys } from '@/lib/query-keys';
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

function createResponse(status: number, data: unknown, message = 'OK'): Response {
  return new Response(
    JSON.stringify({
      statusCode: status,
      success: status >= 200 && status < 300,
      message,
      data,
    }),
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

describe('Session expiry integration', () => {
  beforeEach(() => {
    queryClient.clear();
    resetSessionExpiredGuard();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    queryClient.clear();
    vi.useRealTimers();
  });

  it('redirects an expired cached session with a notice and clears the cache', async () => {
    queryClient.setQueryData(queryKeys.me, mockUser);
    await act(async () => router.navigate('/dashboard?tab=tickets#recent'));
    const fetchMock = mockFetch((path) =>
      path.endsWith('/auth/refresh') || path.endsWith('/test-expire')
        ? createResponse(401, null, 'Session expired')
        : createResponse(401, null, 'No session')
    );

    render(<App />);

    await act(async () => {
      await expect(apiRequest('GET', '/test-expire')).rejects.toMatchObject({ status: 401 });
    });

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toContain(
      `from=${encodeURIComponent('/dashboard?tab=tickets#recent')}`
    );
    expect(router.state.location.state).toEqual(
      expect.objectContaining({ notice: 'session_expired' })
    );
    expect(await screen.findByText('Your session expired. Log in again.')).toBeInTheDocument();
    expect(queryClient.getQueryData(queryKeys.me)).toBeUndefined();
    expect(fetchMock.mock.calls.every(([, init]) => init?.credentials === 'include')).toBe(true);
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(sessionStorage.getItem('accessToken')).toBeNull();
    expect(sessionStorage.getItem('refreshToken')).toBeNull();
  });

  it('redirects a first-load unauthenticated visitor without an expiry notice', async () => {
    await act(async () => router.navigate('/dashboard'));
    mockFetch((path) =>
      path.endsWith('/users/me') || path.endsWith('/auth/refresh')
        ? createResponse(401, null, 'No session')
        : createResponse(200, null)
    );

    render(<App />);

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toContain('from=%2Fdashboard');
    expect(router.state.location.state).toBeNull();
    expect(screen.queryByText(/session expired/i)).toBeNull();
  });

  it('shares one refresh and performs one redirect for concurrent expired requests', async () => {
    queryClient.setQueryData(queryKeys.me, mockUser);
    await act(async () => router.navigate('/dashboard'));
    let refreshCount = 0;
    mockFetch((path) => {
      if (path.endsWith('/auth/refresh')) {
        refreshCount += 1;
        return createResponse(401, null, 'Refresh expired');
      }
      if (path.includes('/protected/')) {
        return createResponse(401, null, 'Access expired');
      }
      return createResponse(401, null, 'No session');
    });

    render(<App />);

    await act(async () => {
      await Promise.allSettled([
        apiRequest('GET', '/protected/1'),
        apiRequest('GET', '/protected/2'),
        apiRequest('GET', '/protected/3'),
      ]);
    });

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(refreshCount).toBe(1);
    expect(router.state.location.state).toEqual(
      expect.objectContaining({ notice: 'session_expired' })
    );
    expect(queryClient.getQueryData(queryKeys.me)).toBeUndefined();
  });
});