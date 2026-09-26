import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMe } from '@/hooks/auth/useMe';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import { ME_STALE_TIME_MS } from '@/config/app.config';
import type { User } from '@/types';

function createWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const mockUser: User = {
  id: 'usr-123',
  name: 'Alex Student',
  email: 'alex@example.com',
  role: 'student',
  emailVerifiedAt: '2026-09-01T00:00:00.000Z',
  createdAt: '2026-09-01T00:00:00.000Z',
};

describe('useMe hook (doc 10 §10.6; EP-11; doc 11 §11.2.4)', () => {
  let queryClient: QueryClient;
  let apiRequestSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retryDelay: 0,
        },
      },
    });
    apiRequestSpy = vi.spyOn(apiClient, 'apiRequest');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('useMe — success: GET /users/me, unwraps data.user, and caches under queryKeys.me', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Current user',
      data: { user: mockUser },
    });

    const { result } = renderHook(() => useMe(), {
      wrapper: createWrapper(queryClient),
    });

    // Never treat user as logged in while query is pending
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith('GET', '/users/me');

    expect(result.current.data).toEqual(mockUser);
    expect(queryClient.getQueryData<User>(queryKeys.me)).toEqual(mockUser);
  });

  it('useMe — 401 normal not-logged-in state: exposes 401 error and does not retry', async () => {
    const error401 = new ApiError(401, 'Unauthorized', 'api');
    apiRequestSpy.mockRejectedValue(error401);

    const { result } = renderHook(() => useMe(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.status).toBe(401);
    expect(result.current.data).toBeUndefined();

    // 401 must never be retried
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
  });

  it('useMe — transient failure: uses shouldRetryQuery to retry once for 5xx/network errors', async () => {
    const error500 = new ApiError(500, 'Server Error', 'api');
    apiRequestSpy
      .mockRejectedValueOnce(error500)
      .mockResolvedValueOnce({
        statusCode: 200,
        message: 'Current user',
        data: { user: mockUser },
      });

    const { result } = renderHook(() => useMe(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Retried once and then succeeded
    expect(apiRequestSpy).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(mockUser);
  });

  it('useMe — persistent network/timeout error: surfaces status 0 and is not treated as logged out (status !== 401)', async () => {
    const networkError = new ApiError(0, 'Network timeout', 'timeout');
    apiRequestSpy.mockRejectedValue(networkError);

    const { result } = renderHook(() => useMe(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Retried once per policy
    expect(apiRequestSpy).toHaveBeenCalledTimes(2);
    expect(result.current.error?.status).toBe(0);
    // Never treat network or timeout error as logged out
    expect(result.current.error?.status).not.toBe(401);
  });

  it('useMe — cache freshness: respects ME_STALE_TIME_MS and does not refetch while fresh', async () => {
    apiRequestSpy.mockResolvedValue({
      statusCode: 200,
      message: 'Current user',
      data: { user: mockUser },
    });

    const { result } = renderHook(() => useMe(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);

    // Advance by less than ME_STALE_TIME_MS
    vi.advanceTimersByTime(ME_STALE_TIME_MS - 1000);

    // Render hook again while fresh
    const { result: secondResult } = renderHook(() => useMe(), {
      wrapper: createWrapper(queryClient),
    });

    expect(secondResult.current.data).toEqual(mockUser);
    expect(apiRequestSpy).toHaveBeenCalledTimes(1); // No new network call
  });

  it('useMe — overrides window focus refetch: refetchOnWindowFocus is disabled (10.23.2)', async () => {
    apiRequestSpy.mockResolvedValue({
      statusCode: 200,
      message: 'Current user',
      data: { user: mockUser },
    });

    const { result } = renderHook(() => useMe(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);

    // Simulate window focus event
    window.dispatchEvent(new Event('focus'));

    expect(apiRequestSpy).toHaveBeenCalledTimes(1); // Still 1, window focus refetch is disabled
  });

  it('useMe — custom options: forwards custom query options', async () => {
    apiRequestSpy.mockResolvedValue({
      statusCode: 200,
      message: 'Current user',
      data: { user: mockUser },
    });

    // enabled: false option should prevent immediate execution
    const { result } = renderHook(() => useMe({ enabled: false }), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isLoading).toBe(false);
    expect(apiRequestSpy).not.toHaveBeenCalled();
  });
});
