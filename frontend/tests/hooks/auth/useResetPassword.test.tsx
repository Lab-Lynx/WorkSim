import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useResetPassword } from '@/hooks/auth/useResetPassword';
import * as apiClient from '@/lib/api/client';
import {
  ApiError,
  mapApiError,
  applyServerErrorToForm,
  SERVER_MESSAGES,
} from '@/lib/api/errors';

function createWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useResetPassword hook (doc 10 §10.6; EP-09; doc 11 §11.2.4)', () => {
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

  it('useResetPassword — success: POST token + new password and resolves with no retry', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Password reset',
      data: null,
    });

    const { result } = renderHook(() => useResetPassword(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isPending).toBe(false);

    act(() => {
      result.current.mutate({
        token: 'valid-reset-token-xyz',
        newPassword: 'newValidPassword123',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith('POST', '/auth/reset-password', {
      body: {
        token: 'valid-reset-token-xyz',
        newPassword: 'newValidPassword123',
      },
    });
  });

  it('useResetPassword — payload isolation: sends only token and newPassword in request body', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Password reset',
      data: null,
    });

    const { result } = renderHook(() => useResetPassword(), {
      wrapper: createWrapper(queryClient),
    });

    const payloadWithExtra = {
      token: 'valid-token',
      newPassword: 'newPassword123',
      extraField: 'shouldNotBeSent',
    } as unknown as { token: string; newPassword: string };

    act(() => {
      result.current.mutate(payloadWithExtra);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledWith('POST', '/auth/reset-password', {
      body: {
        token: 'valid-token',
        newPassword: 'newPassword123',
      },
    });
  });

  it('useResetPassword — 410 expired or used token maps to request_new_link action', async () => {
    const expiredTokenError = new ApiError(410, 'This reset link has expired', 'api');
    apiRequestSpy.mockRejectedValueOnce(expiredTokenError);

    const { result } = renderHook(() => useResetPassword(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        token: 'expired-token',
        newPassword: 'newPassword123',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(expiredTokenError);

    // Map error to verify 410 -> request_new_link behavior
    const uiError = mapApiError(result.current.error);
    expect(uiError.status).toBe(410);
    expect(uiError.action).toBe('request_new_link');
    expect(uiError.message).toBe('This reset link has expired');
    expect(uiError.isNotFound).toBe(false);
  });

  it('useResetPassword — 400 Invalid reset link via applyServerErrorToForm does not set form field', async () => {
    const invalidLinkError = new ApiError(
      400,
      SERVER_MESSAGES.invalidResetLink,
      'api'
    );
    apiRequestSpy.mockRejectedValueOnce(invalidLinkError);

    const { result } = renderHook(() => useResetPassword(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        token: 'invalid-malformed-token',
        newPassword: 'newPassword123',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(invalidLinkError);

    // Verify applyServerErrorToForm('resetPassword') suppresses form.setError
    const mockForm = { setError: vi.fn() };
    const uiError = applyServerErrorToForm(result.current.error, mockForm, 'resetPassword');

    expect(mockForm.setError).not.toHaveBeenCalled();
    expect(uiError.status).toBe(400);
    expect(uiError.message).toBe(SERVER_MESSAGES.invalidResetLink);
  });

  it('useResetPassword — 400 validation error via applyServerErrorToForm sets root error', async () => {
    const validationError = new ApiError(
      400,
      'Password must be at least 8 characters',
      'api'
    );
    apiRequestSpy.mockRejectedValueOnce(validationError);

    const { result } = renderHook(() => useResetPassword(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        token: 'valid-token',
        newPassword: 'short',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    const mockForm = { setError: vi.fn() };
    const uiError = applyServerErrorToForm(result.current.error, mockForm, 'resetPassword');

    expect(mockForm.setError).toHaveBeenCalledTimes(1);
    expect(mockForm.setError).toHaveBeenCalledWith('root', {
      type: 'server',
      message: 'Password must be at least 8 characters',
    });
    expect(uiError.status).toBe(400);
  });

  it('useResetPassword — failure: disables automatic mutation retry', async () => {
    const serverError = new ApiError(500, 'Internal Server Error', 'api');
    apiRequestSpy.mockRejectedValueOnce(serverError);

    const { result } = renderHook(() => useResetPassword(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        token: 'some-token',
        newPassword: 'newPassword123',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(result.current.error).toEqual(serverError);
  });

  it('useResetPassword — custom options: forwards onSuccess and onError callbacks', async () => {
    const onSuccessMock = vi.fn();
    const onErrorMock = vi.fn();

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Password reset',
      data: null,
    });

    const { result } = renderHook(
      () =>
        useResetPassword({
          onSuccess: onSuccessMock,
          onError: onErrorMock,
        }),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    act(() => {
      result.current.mutate({
        token: 'good-token',
        newPassword: 'newPassword123',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(onSuccessMock).toHaveBeenCalledTimes(1);
    expect(onErrorMock).not.toHaveBeenCalled();

    // Test error callback forwarding
    const failureError = new ApiError(410, 'This reset link has expired', 'api');
    apiRequestSpy.mockRejectedValueOnce(failureError);

    act(() => {
      result.current.mutate({
        token: 'bad-token',
        newPassword: 'newPassword123',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(onErrorMock).toHaveBeenCalledTimes(1);
  });
});
