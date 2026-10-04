import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryClient } from '@/lib/queryClient';
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

describe('Authentication flow integration', () => {
  beforeEach(async () => {
    queryClient.clear();
    localStorage.clear();
    sessionStorage.clear();
    await act(async () => router.navigate('/login'));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    queryClient.clear();
  });

  it('logs in and returns to the requested protected route', async () => {
    let loginRequest: RequestInit | undefined;
    mockFetch((path, init) => {
      if (path.endsWith('/auth/login')) {
        loginRequest = init;
        return createResponse(200, { user: mockUser });
      }
      if (path.endsWith('/users/me')) return createResponse(401, null, 'No session');
      return createResponse(200, null);
    });

    render(<App />);
    fireEvent.change(await screen.findByLabelText('Email'), {
      target: { value: mockUser.email },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ValidPassword123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    expect(loginRequest?.credentials).toBe('include');
    expect(JSON.parse(String(loginRequest?.body))).toEqual({
      email: mockUser.email,
      password: 'ValidPassword123!',
    });
    expect(queryClient.getQueryData(queryKeys.me)).toEqual(mockUser);
  });

  it('shows the generic forgot-password confirmation without leaking reset details', async () => {
    let requestBody: unknown;
    mockFetch((path, init) => {
      if (path.endsWith('/auth/forgot-password')) {
        requestBody = JSON.parse(String(init.body));
        return createResponse(200, null, 'If the account exists, an email was sent.');
      }
      if (path.endsWith('/users/me')) return createResponse(401, null, 'No session');
      return createResponse(200, null);
    });

    await act(async () => router.navigate('/forgot-password'));
    render(<App />);

    fireEvent.change(await screen.findByLabelText('Email'), {
      target: { value: mockUser.email },
    });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByText(/if the account exists/i)).toBeInTheDocument();
    expect(requestBody).toEqual({ email: mockUser.email });
    expect(screen.queryByText(/token|secret/i)).toBeNull();
  });
});