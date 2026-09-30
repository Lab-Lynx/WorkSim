import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePayments } from '@/hooks/billing/usePayments';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { Payment } from '@/types';

function createWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const mockPayments: Payment[] = [
  {
    id: 'pay-002',
    amount: '49.00',
    currency: 'USD',
    status: 'succeeded',
    paidAt: '2026-09-15T12:00:00.000Z',
    createdAt: '2026-09-15T11:59:00.000Z',
  },
  {
    id: 'pay-001',
    amount: '49.00',
    currency: 'USD',
    status: 'succeeded',
    paidAt: '2026-08-15T12:00:00.000Z',
    createdAt: '2026-08-15T11:59:00.000Z',
  },
];

describe('usePayments hook (doc 10 §10.7; EP-17; doc 11 §11.2.5)', () => {
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

  it('usePayments — success: GET /payments, unwraps data.payments, and caches under queryKeys.payments', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Payment history',
      data: { payments: mockPayments },
    });

    const { result } = renderHook(() => usePayments(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith('GET', '/payments');

    expect(result.current.data).toEqual(mockPayments);
    expect(queryClient.getQueryData<Payment[]>(queryKeys.payments)).toEqual(mockPayments);
  });

  it('usePayments — list: preserves newest-first order without client-side sorting', async () => {
    // Server returns payments in newest-first order
    const orderedPayments: Payment[] = [
      {
        id: 'pay-newest',
        amount: '100.00',
        currency: 'USD',
        status: 'succeeded',
        paidAt: '2026-09-20T10:00:00.000Z',
        createdAt: '2026-09-20T09:55:00.000Z',
      },
      {
        id: 'pay-middle',
        amount: '50.00',
        currency: 'USD',
        status: 'pending',
        paidAt: null,
        createdAt: '2026-09-10T10:00:00.000Z',
      },
      {
        id: 'pay-oldest',
        amount: '25.00',
        currency: 'USD',
        status: 'failed',
        paidAt: null,
        createdAt: '2026-09-01T10:00:00.000Z',
      },
    ];

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Payment history',
      data: { payments: orderedPayments },
    });

    const { result } = renderHook(() => usePayments(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(orderedPayments);
    expect(result.current.data?.[0].id).toBe('pay-newest');
    expect(result.current.data?.[1].id).toBe('pay-middle');
    expect(result.current.data?.[2].id).toBe('pay-oldest');
  });

  it('usePayments — no client-side filtering: exposes all payment statuses intact', async () => {
    const mixedStatusPayments: Payment[] = [
      {
        id: 'pay-succeeded',
        amount: '49.00',
        currency: 'USD',
        status: 'succeeded',
        paidAt: '2026-09-15T12:00:00.000Z',
        createdAt: '2026-09-15T11:59:00.000Z',
      },
      {
        id: 'pay-pending',
        amount: '49.00',
        currency: 'USD',
        status: 'pending',
        paidAt: null,
        createdAt: '2026-09-16T11:59:00.000Z',
      },
      {
        id: 'pay-failed',
        amount: '49.00',
        currency: 'USD',
        status: 'failed',
        paidAt: null,
        createdAt: '2026-09-17T11:59:00.000Z',
      },
    ];

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Payment history',
      data: { payments: mixedStatusPayments },
    });

    const { result } = renderHook(() => usePayments(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(3);
    expect(result.current.data?.map((p) => p.status)).toEqual(['succeeded', 'pending', 'failed']);
  });

  it('usePayments — no client-side pagination: returns all items returned by the API', async () => {
    const manyPayments: Payment[] = Array.from({ length: 25 }, (_, idx) => ({
      id: `pay-${idx}`,
      amount: '49.00',
      currency: 'USD',
      status: 'succeeded' as const,
      paidAt: '2026-09-01T12:00:00.000Z',
      createdAt: '2026-09-01T11:59:00.000Z',
    }));

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Payment history',
      data: { payments: manyPayments },
    });

    const { result } = renderHook(() => usePayments(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(25);
  });

  it('usePayments — Chapa reference is never present: objects never expose Chapa reference', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Payment history',
      data: { payments: mockPayments },
    });

    const { result } = renderHook(() => usePayments(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    result.current.data?.forEach((payment) => {
      expect(payment).not.toHaveProperty('chapaReference');
      expect(payment).not.toHaveProperty('chapa_reference');
      expect(payment).not.toHaveProperty('reference');
    });
  });

  it('usePayments — empty list: handles empty payments array correctly', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Payment history',
      data: { payments: [] },
    });

    const { result } = renderHook(() => usePayments(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });

  it('usePayments — 401 unauthorized: exposes 401 error and does not retry', async () => {
    const error401 = new ApiError(401, 'Unauthorized', 'api');
    apiRequestSpy.mockRejectedValue(error401);

    const { result } = renderHook(() => usePayments(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.status).toBe(401);
    expect(result.current.data).toBeUndefined();
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
  });

  it('usePayments — transient failure: uses shouldRetryQuery to retry once for 5xx/network errors', async () => {
    const error500 = new ApiError(500, 'Server Error', 'api');
    apiRequestSpy
      .mockRejectedValueOnce(error500)
      .mockResolvedValueOnce({
        statusCode: 200,
        message: 'Payment history',
        data: { payments: mockPayments },
      });

    const { result } = renderHook(() => usePayments(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(mockPayments);
  });

  it('usePayments — persistent error: surfaces ApiError when request fails', async () => {
    const networkError = new ApiError(0, 'Network timeout', 'timeout');
    apiRequestSpy.mockRejectedValue(networkError);

    const { result } = renderHook(() => usePayments(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Retried once per policy then fails
    expect(apiRequestSpy).toHaveBeenCalledTimes(2);
    expect(result.current.error?.status).toBe(0);
    expect(result.current.data).toBeUndefined();
  });

  it('usePayments — custom options: forwards custom query options', async () => {
    apiRequestSpy.mockResolvedValue({
      statusCode: 200,
      message: 'Payment history',
      data: { payments: mockPayments },
    });

    const { result } = renderHook(() => usePayments({ enabled: false }), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isLoading).toBe(false);
    expect(apiRequestSpy).not.toHaveBeenCalled();
  });
});
