import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCancelSubscription } from '@/hooks/billing/useCancelSubscription';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { Subscription } from '@/types';

function createWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const mockCanceledSubscription: Subscription = {
  id: 'sub-123',
  status: 'canceled',
  currentPeriodEnd: '2026-10-15T00:00:00.000Z',
  canceledAt: '2026-09-27T12:00:00.000Z',
};

describe('useCancelSubscription hook (doc 10 §10.7; EP-16; doc 11 §11.2.5 & §11.7)', () => {
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

  it('useCancelSubscription — success: calls POST /subscriptions/cancel with no body, returns subscription, and invalidates queryKeys.subscription', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Subscription canceled',
      data: { subscription: mockCanceledSubscription },
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCancelSubscription(), {
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
    expect(apiRequestSpy).toHaveBeenCalledWith('POST', '/subscriptions/cancel');
    expect(result.current.data).toEqual(mockCanceledSubscription);

    // Verifies queryKeys.subscription is invalidated so server refetch shows truth
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.subscription,
    });
  });

  it('useCancelSubscription — never assumes canceled locally: does not mutate cache directly without server confirmation', async () => {
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Subscription canceled',
      data: { subscription: mockCanceledSubscription },
    });

    const { result } = renderHook(() => useCancelSubscription(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Must never setQueryData locally; must rely on invalidation/refetch
    expect(setQueryDataSpy).not.toHaveBeenCalled();
  });

  it('useCancelSubscription — timeout: invalidates queryKeys.subscription so refetch can reflect already-canceled state', async () => {
    const timeoutError = new ApiError(0, 'Request timed out', 'timeout');
    apiRequestSpy.mockRejectedValueOnce(timeoutError);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCancelSubscription(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(result.current.error).toEqual(timeoutError);

    // Timeout invalidates subscription query
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.subscription,
    });
  });

  it('useCancelSubscription — 409 conflict: invalidates queryKeys.subscription when already canceled elsewhere', async () => {
    const conflictError = new ApiError(409, 'No active subscription to cancel', 'api');
    apiRequestSpy.mockRejectedValueOnce(conflictError);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCancelSubscription(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(conflictError);

    // 409 invalidates subscription query
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.subscription,
    });
  });

  it('useCancelSubscription — 502 Chapa failure: exposes error and does NOT invalidate queryKeys.subscription', async () => {
    const error502 = new ApiError(
      502,
      'Could not cancel with Chapa, please try again',
      'api'
    );
    apiRequestSpy.mockRejectedValueOnce(error502);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCancelSubscription(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error502);
    // 502 keeps dialog open for retry without invalidating subscription
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });

  it('useCancelSubscription — mutation retry is disabled: never auto-retries', async () => {
    const error500 = new ApiError(500, 'Server Error', 'api');
    apiRequestSpy.mockRejectedValueOnce(error500);

    const { result } = renderHook(() => useCancelSubscription(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Exactly one attempt; mutation retry is disabled
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(result.current.error).toEqual(error500);
  });

  it('useCancelSubscription — custom options: forwards onSuccess and onError callbacks', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Subscription canceled',
      data: { subscription: mockCanceledSubscription },
    });

    const { result } = renderHook(
      () => useCancelSubscription({ onSuccess, onError }),
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
    expect(onSuccess).toHaveBeenCalledWith(
      mockCanceledSubscription,
      undefined,
      undefined,
      expect.any(Object)
    );
    expect(onError).not.toHaveBeenCalled();
  });

  it('useCancelSubscription — forwards onError callback on failure', async () => {
    const onError = vi.fn();
    const error409 = new ApiError(409, 'No active subscription to cancel', 'api');
    apiRequestSpy.mockRejectedValueOnce(error409);

    const { result } = renderHook(
      () => useCancelSubscription({ onError }),
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

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      error409,
      undefined,
      undefined,
      expect.any(Object)
    );
  });
});
