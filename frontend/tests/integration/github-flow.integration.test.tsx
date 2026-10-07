import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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

describe('GitHub setup integration', () => {
  beforeEach(async () => {
    queryClient.clear();
    await act(async () => router.navigate('/github'));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    queryClient.clear();
  });

  it('renders a safe OAuth failure and removes callback details from the URL', async () => {
    mockFetch((path) => {
      if (path.endsWith('/users/me')) return response(200, { user: mockUser });
      if (path.endsWith('/subscriptions/me')) return response(200, { subscription: null, hasAccess: false });
      if (path.endsWith('/github/connection')) {
        return response(200, { connected: false, githubLogin: null, repo: null });
      }
      return response(200, null);
    });

    await act(async () => router.navigate('/github?github=error&reason=access_denied'));
    render(<App />);

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).not.toContain('access_denied');
    expect(router.state.location.search).not.toContain('reason=');
  });

  it('shows a retryable provider error without rendering a repository that was not created', async () => {
    let createRequest: RequestInit | undefined;
    mockFetch((path, init) => {
      if (path.endsWith('/users/me')) return response(200, { user: mockUser });
      if (path.endsWith('/subscriptions/me')) return response(200, { subscription: null, hasAccess: true });
      if (path.endsWith('/submissions')) return response(200, { items: [] });
      if (path.endsWith('/github/connection')) {
        return response(200, { connected: true, githubLogin: 'worksim-user', repo: null });
      }
      if (path.endsWith('/github/repo')) {
        createRequest = init;
        return response(502, null, 'Provider unavailable');
      }
      return response(200, null);
    });

    render(<App />);
    fireEvent.click(await screen.findByLabelText('React (Vite + TypeScript)'));
    fireEvent.click(screen.getByRole('button', { name: 'Create repository' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Provider unavailable');
    expect(createRequest?.credentials).toBe('include');
    expect(screen.queryByRole('link', { name: /repository/i })).toBeNull();
  });
});