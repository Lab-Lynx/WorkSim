import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import api, { resetSessionExpiredGuard } from '@/lib/axios';
import { queryClient } from '@/lib/queryClient';
import router from '@/routes';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/store/auth.store';
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

function createAxiosResponse<T>(data: T, config: InternalAxiosRequestConfig, status = 200): AxiosResponse {
  return {
    data: {
      statusCode: status,
      success: status >= 200 && status < 300,
      message: status >= 200 && status < 300 ? 'OK' : 'Error',
      data,
    },
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {},
    config,
  };
}

function createAxios401(config: InternalAxiosRequestConfig, message = 'Session expired or invalid'): AxiosError {
  return new AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, null, {
    data: {
      statusCode: 401,
      success: false,
      message,
      data: null,
    },
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config,
  });
}

describe('Session expiry integration', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.clear();
    sessionStorage.clear();
    queryClient.clear();
    useAuthStore.getState().clearAuth();
    useAuthStore.setState({ isSessionChecked: false });
    if (typeof resetSessionExpiredGuard === 'function') {
      resetSessionExpiredGuard();
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('Expired session with cached user -> redirects to /login?from=... with session_expired notice and cleared cache', async () => {
    // 1. Setup authenticated user in cache and store
    useAuthStore.setState({ user: mockUser, isSessionChecked: true });
    queryClient.setQueryData(queryKeys.me, mockUser);

    await act(async () => {
      await router.navigate('/dashboard');
    });

    const refreshSpy = vi.fn();
    const interceptedConfigs: InternalAxiosRequestConfig[] = [];

    // Mock HTTP adapter at the API client boundary
    api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      interceptedConfigs.push(config);
      if (config.url?.includes('/auth/refresh')) {
        refreshSpy();
        throw createAxios401(config, 'Refresh token expired');
      }
      if (config.url?.includes('/users')) {
        throw createAxios401(config, 'Access token expired');
      }
      return createAxiosResponse({ ok: true }, config);
    };

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    // Trigger an authenticated request that 401s and refresh also 401s
    await act(async () => {
      try {
        await api.get('/users');
      } catch {
        // Expected to fail
      }
    });

    // Verify redirect to /login?from=%2Fdashboard
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
      expect(router.state.location.search).toContain('from=%2Fdashboard');
    });

    // Verify router state has notice: 'session_expired'
    expect(router.state.location.state).toEqual(
      expect.objectContaining({ notice: 'session_expired' })
    );

    // Verify the "Your session expired. Log in again." notice is rendered on the page
    await waitFor(() => {
      expect(screen.getByText('Your session expired. Log in again.')).toBeInTheDocument();
    });

    // Verify cache is cleared
    expect(queryClient.getQueryData(queryKeys.me)).toBeUndefined();
    expect(useAuthStore.getState().user).toBeNull();

    // Verify credentials: every request sent withCredentials
    expect(interceptedConfigs.length).toBeGreaterThan(0);
    interceptedConfigs.forEach((cfg) => {
      expect(cfg.withCredentials).toBe(true);
    });

    // Verify security: no tokens stored in localStorage or sessionStorage
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(sessionStorage.getItem('accessToken')).toBeNull();
    expect(sessionStorage.getItem('refreshToken')).toBeNull();
  });

  it('First load with no session -> redirects to /login?from=... without session expired notice', async () => {
    // Setup unauthenticated visitor on cold start
    useAuthStore.setState({ user: null, isSessionChecked: false });
    queryClient.clear();

    await act(async () => {
      await router.navigate('/dashboard');
    });

    api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/auth/me') || config.url?.includes('/auth/refresh')) {
        throw createAxios401(config, 'No session');
      }
      return createAxiosResponse(null, config);
    };

    render(<App />);

    // Wait for redirect to login
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });

    // From parameter preserves the attempted path
    expect(router.state.location.search).toContain('from=%2Fdashboard');

    // Location state should NOT have session_expired notice
    const locationState = router.state.location.state as { notice?: string } | null;
    expect(locationState?.notice).toBeUndefined();

    // The "session expired" notice text must NOT appear
    expect(screen.queryByText(/session expired/i)).toBeNull();
  });

  it('Many failing requests -> one refresh and one redirect', async () => {
    useAuthStore.setState({ user: mockUser, isSessionChecked: true });
    queryClient.setQueryData(queryKeys.me, mockUser);

    await act(async () => {
      await router.navigate('/dashboard');
    });

    let refreshCount = 0;
    const navigateSpy = vi.spyOn(router, 'navigate');

    api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/auth/refresh')) {
        refreshCount++;
        // Small delay to simulate in-flight refresh
        await new Promise((r) => setTimeout(r, 10));
        throw createAxios401(config, 'Dead refresh token');
      }
      if (config.url?.includes('/api-test')) {
        throw createAxios401(config, 'Expired token');
      }
      return createAxiosResponse({}, config);
    };

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    // Fire 5 concurrent requests that 401
    await act(async () => {
      await Promise.allSettled([
        api.get('/api-test/1'),
        api.get('/api-test/2'),
        api.get('/api-test/3'),
        api.get('/api-test/4'),
        api.get('/api-test/5'),
      ]);
    });

    // Exactly one refresh request was fired
    expect(refreshCount).toBe(1);

    // Filter navigations that were to /login
    const loginNavigations = navigateSpy.mock.calls.filter(([target]) => {
      if (typeof target === 'string') return target.startsWith('/login');
      if (typeof target === 'object' && target !== null && 'pathname' in target) {
        return (target as { pathname: string }).pathname.startsWith('/login');
      }
      return false;
    });

    // Exactly one redirect to /login
    expect(loginNavigations.length).toBe(1);

    // Redirect landed on login with session_expired notice
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.state).toEqual(
      expect.objectContaining({ notice: 'session_expired' })
    );

    // Cache was cleared
    expect(queryClient.getQueryData(queryKeys.me)).toBeUndefined();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('Protected route -> expired access cookie replays request once when refresh succeeds', async () => {
    useAuthStore.setState({ user: mockUser, isSessionChecked: true });
    queryClient.setQueryData(queryKeys.me, mockUser);

    await act(async () => {
      await router.navigate('/dashboard');
    });

    let refreshCalled = false;
    let initialCallAttempts = 0;

    api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/auth/refresh')) {
        refreshCalled = true;
        return createAxiosResponse({ ok: true }, config);
      }
      if (config.url?.includes('/protected-data')) {
        initialCallAttempts++;
        if (initialCallAttempts === 1) {
          throw createAxios401(config, 'Access token expired');
        }
        return createAxiosResponse({ secret: 'preserved-data' }, config);
      }
      return createAxiosResponse({}, config);
    };

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    let resultData: unknown = null;
    await act(async () => {
      const res = await api.get<{ secret: string }>('/protected-data');
      resultData = res.data;
    });

    // Replay succeeded with data
    expect(resultData).toEqual({ secret: 'preserved-data' });
    expect(refreshCalled).toBe(true);
    expect(initialCallAttempts).toBe(2);

    // User is still on /dashboard, not redirected
    expect(router.state.location.pathname).toBe('/dashboard');
    expect(useAuthStore.getState().user).toEqual(mockUser);
  });

  it('Preserves query string and hash in from parameter on session expiry', async () => {
    useAuthStore.setState({ user: mockUser, isSessionChecked: true });
    queryClient.setQueryData(queryKeys.me, mockUser);

    await act(async () => {
      await router.navigate('/dashboard?tab=tickets&view=all#recent');
    });

    api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/auth/refresh')) {
        throw createAxios401(config, 'Session ended');
      }
      if (config.url?.includes('/test-deep')) {
        throw createAxios401(config, 'Session ended');
      }
      return createAxiosResponse({}, config);
    };

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    await act(async () => {
      try {
        await api.get('/test-deep');
      } catch {
        // Expected
      }
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });

    // The from parameter preserves full query and hash encoded
    const expectedEncoded = encodeURIComponent('/dashboard?tab=tickets&view=all#recent');
    expect(router.state.location.search).toContain(`from=${expectedEncoded}`);
    expect(router.state.location.state).toEqual(
      expect.objectContaining({ notice: 'session_expired' })
    );
  });

  it('Many requests -> one refresh and all replay once when refresh succeeds', async () => {
    useAuthStore.setState({ user: mockUser, isSessionChecked: true });
    queryClient.setQueryData(queryKeys.me, mockUser);

    await act(async () => {
      await router.navigate('/dashboard');
    });

    let refreshCount = 0;
    const requestAttempts: Record<string, number> = {};

    api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/auth/refresh')) {
        refreshCount++;
        await new Promise((r) => setTimeout(r, 10));
        return createAxiosResponse({ ok: true }, config);
      }

      const url = config.url || '';
      requestAttempts[url] = (requestAttempts[url] || 0) + 1;

      if (requestAttempts[url] === 1) {
        throw createAxios401(config, 'Access token expired');
      }

      return createAxiosResponse({ item: url }, config);
    };

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    let responses: unknown[] = [];
    await act(async () => {
      const results = await Promise.all([
        api.get('/concurrent/1'),
        api.get('/concurrent/2'),
        api.get('/concurrent/3'),
      ]);
      responses = results.map((r) => r.data);
    });

    // Exactly one refresh was fired
    expect(refreshCount).toBe(1);

    // Each request was tried twice (initial 401 + replay success)
    expect(requestAttempts['/concurrent/1']).toBe(2);
    expect(requestAttempts['/concurrent/2']).toBe(2);
    expect(requestAttempts['/concurrent/3']).toBe(2);

    expect(responses).toEqual([
      { item: '/concurrent/1' },
      { item: '/concurrent/2' },
      { item: '/concurrent/3' },
    ]);

    // Still on /dashboard
    expect(router.state.location.pathname).toBe('/dashboard');
  });

  it('Displays login notices for password_reset and logged_out_all without session expiry redirect', async () => {
    // Test password_reset notice
    await act(async () => {
      await router.navigate('/login', { state: { notice: 'password_reset' } });
    });

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Password reset. Log in with your new password.')
      ).toBeInTheDocument();
    });

    // Test logged_out_all notice
    await act(async () => {
      await router.navigate('/login', { state: { notice: 'logged_out_all' } });
    });

    rerender(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("You've been logged out of all devices.")).toBeInTheDocument();
    });
  });

  it('Secret leakage check: sentinel tokens never appear in the rendered document or client state', async () => {
    const sentinelToken = 'SECRET_SENTINEL_REFRESH_TOKEN_DO_NOT_LEAK';

    useAuthStore.setState({ user: mockUser, isSessionChecked: true });
    queryClient.setQueryData(queryKeys.me, mockUser);

    await act(async () => {
      await router.navigate('/dashboard');
    });

    api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/auth/refresh')) {
        throw createAxios401(config, sentinelToken);
      }
      throw createAxios401(config, 'Access expired');
    };

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    await act(async () => {
      try {
        await api.get('/secret-test');
      } catch {
        // Expected
      }
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });

    // Verify sentinel token does NOT appear in DOM
    expect(document.body.textContent).not.toContain(sentinelToken);

    // Verify sentinel token does NOT appear in storage
    expect(JSON.stringify(localStorage)).not.toContain(sentinelToken);
    expect(JSON.stringify(sessionStorage)).not.toContain(sentinelToken);
  });

  it('Protected route -> replay returns 401 after successful refresh triggers session expiry redirect', async () => {
    useAuthStore.setState({ user: mockUser, isSessionChecked: true });
    queryClient.setQueryData(queryKeys.me, mockUser);

    await act(async () => {
      await router.navigate('/dashboard');
    });

    let refreshCalled = false;
    let attempts = 0;

    api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/auth/refresh')) {
        refreshCalled = true;
        return createAxiosResponse({ ok: true }, config);
      }
      if (config.url?.includes('/replay-fails')) {
        attempts++;
        // Both initial request and replay return 401
        throw createAxios401(config, 'Still unauthorized after refresh');
      }
      return createAxiosResponse({}, config);
    };

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    await act(async () => {
      try {
        await api.get('/replay-fails');
      } catch {
        // Expected
      }
    });

    // Refresh was called
    expect(refreshCalled).toBe(true);
    // Attempted twice (initial + replay)
    expect(attempts).toBe(2);

    // Redirected to login with session_expired notice
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
    expect(router.state.location.state).toEqual(
      expect.objectContaining({ notice: 'session_expired' })
    );

    // Cache and auth store cleared
    expect(queryClient.getQueryData(queryKeys.me)).toBeUndefined();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('Protected route -> refresh fails with 5xx/network error does not log user out or clear cache', async () => {
    useAuthStore.setState({ user: mockUser, isSessionChecked: true });
    queryClient.setQueryData(queryKeys.me, mockUser);

    await act(async () => {
      await router.navigate('/dashboard');
    });

    api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      if (config.url?.includes('/auth/refresh')) {
        // Server 500 error on refresh
        throw new AxiosError('Internal Server Error', 'ERR_BAD_RESPONSE', config, null, {
          data: { statusCode: 500, success: false, message: 'Server error', data: null },
          status: 500,
          statusText: 'Internal Server Error',
          headers: {},
          config,
        });
      }
      if (config.url?.includes('/network-test')) {
        throw createAxios401(config, 'Access expired');
      }
      return createAxiosResponse({}, config);
    };

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );

    await act(async () => {
      try {
        await api.get('/network-test');
      } catch {
        // Expected
      }
    });

    // Should NOT redirect to /login
    expect(router.state.location.pathname).toBe('/dashboard');

    // Should NOT clear user state or cache on transient server error
    expect(queryClient.getQueryData(queryKeys.me)).toEqual(mockUser);
    expect(useAuthStore.getState().user).toEqual(mockUser);
  });
});

