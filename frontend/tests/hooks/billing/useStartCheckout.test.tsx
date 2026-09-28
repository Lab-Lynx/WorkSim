import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStartCheckout } from '@/hooks/billing/useStartCheckout';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';

function createWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useStartCheckout hook (doc 10 §10.7; EP-13; doc 11 §11.2.5 & §11.9)', () => {
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

  it('useStartCheckout — success: POST with no body (FR-17), returns checkoutUrl, and does not navigate', async () => {
    const checkoutUrl = 'https://checkout.chapa.co/checkout/web/payment/test-chapa-ref';
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 201,
      message: 'Checkout created',
      data: { checkoutUrl },
    });

    const initialHref = window.location.href;

    const { result } = renderHook(() => useStartCheckout(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isPending).toBe(false);

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // EP-13 POST /subscriptions/checkout with no body
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith('POST', '/subscriptions/checkout');

    // Returns checkoutUrl
    expect(result.current.data).toEqual({ checkoutUrl });

    // Does not navigate (BillingPage does)
    expect(window.location.href).toBe(initialHref);
  });

  it('useStartCheckout — does not mark subscription active locally', async () => {
    const checkoutUrl = 'https://checkout.chapa.co/checkout/web/payment/test-chapa-ref';
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 201,
      message: 'Checkout created',
      data: { checkoutUrl },
    });

    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

    const { result } = renderHook(() => useStartCheckout(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Never sets query data for subscription or changes local access state
    expect(setQueryDataSpy).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(queryKeys.subscription)).toBeUndefined();
  });

  describe('URL validation (A-67)', () => {
    it('throws ApiError with kind "unexpected_response" if checkoutUrl uses insecure http: protocol', async () => {
      apiRequestSpy.mockResolvedValueOnce({
        statusCode: 201,
        message: 'Checkout created',
        data: { checkoutUrl: 'http://insecure.chapa.co/checkout/payment/123' },
      });

      const { result } = renderHook(() => useStartCheckout(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate();
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(ApiError);
      expect(result.current.error?.kind).toBe('unexpected_response');
    });

    it('throws ApiError with kind "unexpected_response" if checkoutUrl is a relative URL', async () => {
      apiRequestSpy.mockResolvedValueOnce({
        statusCode: 201,
        message: 'Checkout created',
        data: { checkoutUrl: '/billing/pay/123' },
      });

      const { result } = renderHook(() => useStartCheckout(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate();
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(ApiError);
      expect(result.current.error?.kind).toBe('unexpected_response');
    });

    it('throws ApiError with kind "unexpected_response" if checkoutUrl is javascript: or non-https scheme', async () => {
      apiRequestSpy.mockResolvedValueOnce({
        statusCode: 201,
        message: 'Checkout created',
        data: { checkoutUrl: 'javascript:alert(1)' },
      });

      const { result } = renderHook(() => useStartCheckout(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate();
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(ApiError);
      expect(result.current.error?.kind).toBe('unexpected_response');
    });

    it('throws ApiError with kind "unexpected_response" if checkoutUrl is missing or invalid type', async () => {
      apiRequestSpy.mockResolvedValueOnce({
        statusCode: 201,
        message: 'Checkout created',
        data: { checkoutUrl: '' } as unknown as { checkoutUrl: string },
      });

      const { result } = renderHook(() => useStartCheckout(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate();
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(ApiError);
      expect(result.current.error?.kind).toBe('unexpected_response');
    });
  });

  describe('Side effects on error (doc 10 §10.7)', () => {
    it('useStartCheckout — 409 conflict: invalidates queryKeys.subscription and queryKeys.payments', async () => {
      const conflictError = new ApiError(409, 'You already have an active subscription', 'api');
      apiRequestSpy.mockRejectedValueOnce(conflictError);

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useStartCheckout(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate();
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(conflictError);
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.subscription,
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.payments,
      });
    });

    it('useStartCheckout — timeout: invalidates queryKeys.subscription and queryKeys.payments', async () => {
      const timeoutError = new ApiError(0, 'Request timed out', 'timeout');
      apiRequestSpy.mockRejectedValueOnce(timeoutError);

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useStartCheckout(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate();
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(timeoutError);
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.subscription,
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.payments,
      });
    });

    it('useStartCheckout — timeout with status 504: invalidates queryKeys.subscription and queryKeys.payments', async () => {
      const timeout504Error = new ApiError(504, 'Gateway Timeout', 'api');
      apiRequestSpy.mockRejectedValueOnce(timeout504Error);

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useStartCheckout(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate();
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(timeout504Error);
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.subscription,
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.payments,
      });
    });

    it('useStartCheckout — 502 Chapa failure: exposes error and does NOT invalidate cache', async () => {
      const error502 = new ApiError(
        502,
        'Could not start checkout with Chapa, please try again',
        'api'
      );
      apiRequestSpy.mockRejectedValueOnce(error502);

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useStartCheckout(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate();
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(error502);
      expect(invalidateQueriesSpy).not.toHaveBeenCalled();
    });

    it('useStartCheckout — 403 unverified email: exposes error and does NOT invalidate cache', async () => {
      const error403 = new ApiError(403, 'Verify your email before subscribing', 'api');
      apiRequestSpy.mockRejectedValueOnce(error403);

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useStartCheckout(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate();
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(error403);
      expect(invalidateQueriesSpy).not.toHaveBeenCalled();
    });

    it('useStartCheckout — 402 payment required: exposes error and does NOT invalidate cache', async () => {
      const error402 = new ApiError(402, 'Payment required', 'api');
      apiRequestSpy.mockRejectedValueOnce(error402);

      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useStartCheckout(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.mutate();
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(error402);
      expect(invalidateQueriesSpy).not.toHaveBeenCalled();
    });
  });

  describe('Mutation retry and options forwarding', () => {
    it('useStartCheckout — mutation retry is disabled: never auto-retries', async () => {
      const error500 = new ApiError(500, 'Server Error', 'api');
      apiRequestSpy.mockRejectedValueOnce(error500);

      const { result } = renderHook(() => useStartCheckout(), {
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

    it('useStartCheckout — forwards custom onSuccess and onError callbacks', async () => {
      const onSuccess = vi.fn();
      const onError = vi.fn();
      const checkoutUrl = 'https://checkout.chapa.co/checkout/web/payment/test-chapa-ref';

      apiRequestSpy.mockResolvedValueOnce({
        statusCode: 201,
        message: 'Checkout created',
        data: { checkoutUrl },
      });

      const { result } = renderHook(
        () => useStartCheckout({ onSuccess, onError }),
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
        { checkoutUrl },
        undefined,
        undefined,
        expect.any(Object)
      );
      expect(onError).not.toHaveBeenCalled();
    });

    it('useStartCheckout — forwards custom onError callback on failure', async () => {
      const onError = vi.fn();
      const error502 = new ApiError(502, 'Bad Gateway', 'api');
      apiRequestSpy.mockRejectedValueOnce(error502);

      const { result } = renderHook(
        () => useStartCheckout({ onError }),
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
        error502,
        undefined,
        undefined,
        expect.any(Object)
      );
    });
  });
});
