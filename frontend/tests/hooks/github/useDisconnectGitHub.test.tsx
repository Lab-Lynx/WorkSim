import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDisconnectGitHub } from '@/hooks/github/useDisconnectGitHub';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';

function createWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useDisconnectGitHub hook (doc 10 §10.8; EP-21; doc 11 §11.2.6, §11.7 & §11.9)', () => {
  let queryClient: QueryClient;
  let apiRequestSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    apiRequestSpy = vi.spyOn(apiClient, 'apiRequest');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('useDisconnectGitHub — success: calls DELETE /github/connection and invalidates queryKeys.githubConnection onSettled', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'GitHub disconnected',
      data: null,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDisconnectGitHub(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isPending).toBe(false);

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith('DELETE', '/github/connection');

    // Invalidates githubConnection onSettled
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.githubConnection,
    });
  });

  it('useDisconnectGitHub — rethrows 404 "GitHub is not connected" and still invalidates queryKeys.githubConnection', async () => {
    const error404 = new ApiError(404, 'GitHub is not connected', 'api');
    apiRequestSpy.mockRejectedValueOnce(error404);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDisconnectGitHub(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Rethrows 404 so caller page can treat it as already disconnected
    expect(result.current.error).toEqual(error404);
    expect(result.current.error?.status).toBe(404);
    expect(result.current.error?.message).toBe('GitHub is not connected');

    // Invalidation still runs on failure via onSettled
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.githubConnection,
    });
  });

  it('useDisconnectGitHub — invalidates queryKeys.githubConnection on other errors (500 / network)', async () => {
    const error500 = new ApiError(500, 'Server Error', 'api');
    apiRequestSpy.mockRejectedValueOnce(error500);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDisconnectGitHub(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error500);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.githubConnection,
    });
  });

  it('useDisconnectGitHub — mutation retry is disabled: never auto-retries', async () => {
    const error500 = new ApiError(500, 'Server Error', 'api');
    apiRequestSpy.mockRejectedValueOnce(error500);

    const { result } = renderHook(() => useDisconnectGitHub(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(result.current.error).toEqual(error500);
  });

  it('useDisconnectGitHub — forwards custom onSuccess, onError, and onSettled options', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const onSettled = vi.fn();

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'GitHub disconnected',
      data: null,
    });

    const { result } = renderHook(
      () => useDisconnectGitHub({ onSuccess, onError, onSettled }),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('useDisconnectGitHub — forwards custom onError and onSettled on failure', async () => {
    const onError = vi.fn();
    const onSettled = vi.fn();
    const error404 = new ApiError(404, 'GitHub is not connected', 'api');

    apiRequestSpy.mockRejectedValueOnce(error404);

    const { result } = renderHook(
      () => useDisconnectGitHub({ onError, onSettled }),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(onError).toHaveBeenCalledWith(
      error404,
      undefined,
      undefined,
      expect.any(Object)
    );
    expect(onSettled).toHaveBeenCalledWith(
      undefined,
      error404,
      undefined,
      undefined,
      expect.any(Object)
    );
  });
});
