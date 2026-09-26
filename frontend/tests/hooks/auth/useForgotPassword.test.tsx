import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useForgotPassword } from '@/hooks/auth/useForgotPassword';
import * as apiClient from '@/lib/api/client';
import { ApiError, mapApiError, applyServerErrorToForm } from '@/lib/api/errors';

function createWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useForgotPassword hook (doc 10 §10.6; EP-08; doc 11 §11.2.4)', () => {
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

  it('useForgotPassword — success: POST email and returns server message unchanged without revealing account existence', async () => {
    const serverMessage = 'If an account exists for this email, a reset link has been sent';
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: serverMessage,
      data: null,
    });

    const { result } = renderHook(() => useForgotPassword(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isPending).toBe(false);

    act(() => {
      result.current.mutate({ email: 'student@example.com' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith('POST', '/auth/forgot-password', {
      body: { email: 'student@example.com' },
    });

    expect(result.current.data).toEqual({ message: serverMessage });
  });

  it('useForgotPassword — payload isolation: sends only email in request body', async () => {
    const serverMessage = 'If an account exists for this email, a reset link has been sent';
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: serverMessage,
      data: null,
    });

    const { result } = renderHook(() => useForgotPassword(), {
      wrapper: createWrapper(queryClient),
    });

    const payloadWithExtra = {
      email: 'student@example.com',
      unexpectedProp: 'extra-val',
    } as unknown as { email: string };

    act(() => {
      result.current.mutate(payloadWithExtra);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledWith('POST', '/auth/forgot-password', {
      body: { email: 'student@example.com' },
    });
  });

  it('useForgotPassword — 400 validation failure: surfaces ApiError and sets root in form', async () => {
    const validationError = new ApiError(400, 'Enter a valid email address', 'api');
    apiRequestSpy.mockRejectedValueOnce(validationError);

    const { result } = renderHook(() => useForgotPassword(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ email: 'invalid-email' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(validationError);

    const mockForm = { setError: vi.fn() };
    const uiError = applyServerErrorToForm(result.current.error, mockForm);

    expect(mockForm.setError).toHaveBeenCalledTimes(1);
    expect(mockForm.setError).toHaveBeenCalledWith('root', {
      type: 'server',
      message: 'Enter a valid email address',
    });
    expect(uiError.status).toBe(400);
  });

  it('useForgotPassword — 429 rate limited: surfaces ApiError and maps to action none', async () => {
    const rateLimitError = new ApiError(429, 'Too many requests. Please try again later.', 'api');
    apiRequestSpy.mockRejectedValueOnce(rateLimitError);

    const { result } = renderHook(() => useForgotPassword(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ email: 'student@example.com' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(rateLimitError);
    const uiError = mapApiError(result.current.error);
    expect(uiError.status).toBe(429);
    expect(uiError.action).toBe('none');
    expect(uiError.message).toBe('Too many requests. Please try again later.');
  });

  it('useForgotPassword — failure: disables automatic mutation retry', async () => {
    const serverError = new ApiError(500, 'Internal Server Error', 'api');
    apiRequestSpy.mockRejectedValueOnce(serverError);

    const { result } = renderHook(() => useForgotPassword(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ email: 'student@example.com' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(result.current.error).toEqual(serverError);
  });

  it('useForgotPassword — custom options: forwards onSuccess and onError callbacks', async () => {
    const onSuccessMock = vi.fn();
    const onErrorMock = vi.fn();

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Reset link dispatched',
      data: null,
    });

    const { result } = renderHook(
      () =>
        useForgotPassword({
          onSuccess: onSuccessMock,
          onError: onErrorMock,
        }),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    act(() => {
      result.current.mutate({ email: 'student@example.com' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(onSuccessMock).toHaveBeenCalledTimes(1);
    expect(onSuccessMock).toHaveBeenCalledWith(
      { message: 'Reset link dispatched' },
      { email: 'student@example.com' },
      undefined,
      expect.any(Object)
    );
    expect(onErrorMock).not.toHaveBeenCalled();

    // Test error callback forwarding
    const failureError = new ApiError(400, 'Invalid request', 'api');
    apiRequestSpy.mockRejectedValueOnce(failureError);

    act(() => {
      result.current.mutate({ email: 'bad@example.com' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(onErrorMock).toHaveBeenCalledTimes(1);
  });
});
