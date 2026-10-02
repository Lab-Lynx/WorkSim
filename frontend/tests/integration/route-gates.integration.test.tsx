import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
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

function mockFetch(user: User | null) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    return Promise.resolve(
      new URL(url).pathname.endsWith('/users/me')
        ? user
          ? response(200, { user })
          : response(401, null, 'No session')
        : response(200, null)
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('Route gates integration', () => {
  beforeEach(async () => {
    queryClient.clear();
    await act(async () => router.navigate('/'));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    queryClient.clear();
  });

  it('sends an anonymous visitor from a protected route to login with a safe return path', async () => {
    mockFetch(null);
    await act(async () => router.navigate('/settings?section=profile'));
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toContain('from=%2Fsettings%3Fsection%3Dprofile');
  });

  it('redirects an authenticated public-only visitor to the safe fallback', async () => {
    mockFetch(mockUser);
    await act(async () => router.navigate('/login?from=%2F%2Fevil.example'));
    render(<App />);

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    expect(router.state.location.pathname).not.toContain('evil.example');
  });

  it('routes the root and unknown paths to their expected destinations and shells', async () => {
    mockFetch(null);
    render(<App />);

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('');

    await act(async () => router.navigate('/not-a-real-page'));
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to login' })).toHaveAttribute('href', '/login');
  });
});