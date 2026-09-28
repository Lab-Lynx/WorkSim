import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSubscription } from '@/hooks/billing/useSubscription';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { Subscription, SubscriptionStatusResponse } from '@/types';

function createWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const mockActiveSubscription: Subscription = {
  id: 'sub-active-123',
  status: 'active',
  currentPeriodEnd: '2026-10-28T00:00:00.000Z',
  canceledAt: null,
};

const mockStatusResponse: SubscriptionStatusResponse = {
  subscription: mockActiveSubscription,
  hasAccess: true,
};

describe('useSubscription hook (doc 10 §10.7; EP-15; doc 11 §11.2.5 & §11.9)', () => {
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

  it('useSubscription — initial query: GET /subscriptions/me, caches under queryKeys.subscription, and exposes subscription/hasAccess', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Subscription status',
      data: mockStatusResponse,
    });

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith('GET', '/subscriptions/me');

    expect(result.current.data).toEqual(mockStatusResponse);
    expect(
      queryClient.getQueryData<SubscriptionStatusResponse>(queryKeys.subscription)
    ).toEqual(mockStatusResponse);
  });

  it('useSubscription — never-subscribed user: handles subscription: null and hasAccess: false', async () => {
    const neverSubscribedResponse: SubscriptionStatusResponse = {
      subscription: null,
      hasAccess: false,
    };

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Subscription status',
      data: neverSubscribedResponse,
    });

    const { result } = renderHook(() => useSubscription(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(neverSubscribedResponse);
    expect(result.current.data?.subscription).toBeNull();
    expect(result.current.data?.hasAccess).toBe(false);
  });

  describe('Authoritative hasAccess (no client-side clock recomputation)', () => {
    it('uses hasAccess exactly as sent when server says true even if currentPeriodEnd is in past', async () => {
      const pastPeriodSubscription: Subscription = {
        id: 'sub-past-1',
        status: 'active',
        currentPeriodEnd: '2020-01-01T00:00:00.000Z',
        canceledAt: null,
      };

      const serverSaysHasAccess: SubscriptionStatusResponse = {
        subscription: pastPeriodSubscription,
        hasAccess: true,
      };

      apiRequestSpy.mockResolvedValueOnce({
        statusCode: 200,
        message: 'Subscription status',
        data: serverSaysHasAccess,
      });

      const { result } = renderHook(() => useSubscription(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Never recomputes from currentPeriodEnd; respects server's authoritative hasAccess
      expect(result.current.data?.hasAccess).toBe(true);
    });

    it('uses hasAccess exactly as sent when server says false even if currentPeriodEnd is in distant future', async () => {
      const futurePeriodSubscription: Subscription = {
        id: 'sub-future-1',
        status: 'past_due',
        currentPeriodEnd: '2099-01-01T00:00:00.000Z',
        canceledAt: null,
      };

      const serverSaysNoAccess: SubscriptionStatusResponse = {
        subscription: futurePeriodSubscription,
        hasAccess: false,
      };

      apiRequestSpy.mockResolvedValueOnce({
        statusCode: 200,
        message: 'Subscription status',
        data: serverSaysNoAccess,
      });

      const { result } = renderHook(() => useSubscription(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Never recomputes from currentPeriodEnd; respects server's authoritative hasAccess
      expect(result.current.data?.hasAccess).toBe(false);
    });
  });

  describe('Polling behavior and limits (no hook-level limits; page owns them)', () => {
    it('polls according to refetchIntervalMs when specified', async () => {
      apiRequestSpy.mockResolvedValue({
        statusCode: 200,
        message: 'Subscription status',
        data: mockStatusResponse,
      });

      const { result } = renderHook(
        () => useSubscription({ refetchIntervalMs: 2000 }),
        {
          wrapper: createWrapper(queryClient),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(apiRequestSpy).toHaveBeenCalledTimes(1);

      // Advance by polling interval
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(apiRequestSpy).toHaveBeenCalledTimes(2);
      });

      // Advance by polling interval again
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(apiRequestSpy).toHaveBeenCalledTimes(3);
      });
    });

    it('does not enforce polling limits in the hook itself (CheckoutReturnPage owns them)', async () => {
      apiRequestSpy.mockResolvedValue({
        statusCode: 200,
        message: 'Subscription status',
        data: mockStatusResponse,
      });

      const { result } = renderHook(
        () => useSubscription({ refetchIntervalMs: 1000 }),
        {
          wrapper: createWrapper(queryClient),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Step through successive polling cycles and assert the hook continues polling
      for (let cycle = 1; cycle <= 5; cycle++) {
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });

        await waitFor(() => {
          expect(apiRequestSpy).toHaveBeenCalledTimes(cycle + 1);
        });
      }

      expect(apiRequestSpy).toHaveBeenCalledTimes(6);
    });

    it('does not poll when refetchIntervalMs is false or not provided', async () => {
      apiRequestSpy.mockResolvedValue({
        statusCode: 200,
        message: 'Subscription status',
        data: mockStatusResponse,
      });

      const { result } = renderHook(() => useSubscription({ refetchIntervalMs: false }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(apiRequestSpy).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(10000);
      });

      expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge cases, errors, and cache behavior', () => {
    it('preserves cached data when a background refetch fails', async () => {
      apiRequestSpy
        .mockResolvedValueOnce({
          statusCode: 200,
          message: 'Subscription status',
          data: mockStatusResponse,
        })
        .mockRejectedValue(new ApiError(500, 'Server error', 'api'));

      const { result } = renderHook(
        () => useSubscription({ refetchIntervalMs: 2000 }),
        {
          wrapper: createWrapper(queryClient),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockStatusResponse);

      // Trigger background refetch failure
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      // Data is still available from cache
      expect(result.current.data).toEqual(mockStatusResponse);
    });

    it('exposes 401 error and does not retry unauthorized requests', async () => {
      const error401 = new ApiError(401, 'Unauthorized', 'api');
      apiRequestSpy.mockRejectedValue(error401);

      const { result } = renderHook(() => useSubscription(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error?.status).toBe(401);
      expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    });

    it('retries transient 500 error once per shouldRetryQuery', async () => {
      const error500 = new ApiError(500, 'Internal Server Error', 'api');
      apiRequestSpy
        .mockRejectedValueOnce(error500)
        .mockResolvedValueOnce({
          statusCode: 200,
          message: 'Subscription status',
          data: mockStatusResponse,
        });

      const { result } = renderHook(() => useSubscription(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(apiRequestSpy).toHaveBeenCalledTimes(2);
      expect(result.current.data).toEqual(mockStatusResponse);
    });

    it('forwards custom options such as enabled: false', async () => {
      apiRequestSpy.mockResolvedValue({
        statusCode: 200,
        message: 'Subscription status',
        data: mockStatusResponse,
      });

      const { result } = renderHook(() => useSubscription({ enabled: false }), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(false);
      expect(apiRequestSpy).not.toHaveBeenCalled();
    });
  });
});
