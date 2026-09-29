import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useChangePassword } from '@/hooks/auth/useChangePassword';
import * as apiClient from '@/lib/api/client';
import { ApiError, applyServerErrorToForm, SERVER_MESSAGES } from '@/lib/api/errors';

function createWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useChangePassword hook (doc 10 §10.6; EP-10; doc 11 §11.2.4)', () => {
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

  it('useChangePassword — success: POST current + new password and resolves with no retry', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Password changed',
      data: null,
    });

    const { result } = renderHook(() => useChangePassword(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isPending).toBe(false);

    act(() => {
      result.current.mutate({
        currentPassword: 'currentValidPassword123',
        newPassword: 'newSecurePassword456',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith('POST', '/auth/change-password', {
      body: {
        currentPassword: 'currentValidPassword123',
        newPassword: 'newSecurePassword456',
      },
    });
  });

  it('useChangePassword — payload isolation: sends only currentPassword and newPassword', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Password changed',
      data: null,
    });

    const { result } = renderHook(() => useChangePassword(), {
      wrapper: createWrapper(queryClient),
    });

    const payloadWithExtra = {
      currentPassword: 'oldPassword1',
      newPassword: 'newPassword2',
      confirmPassword: 'newPassword2',
      extraField: 'unexpected',
    } as unknown as { currentPassword: string; newPassword: string };

    act(() => {
      result.current.mutate(payloadWithExtra);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledWith('POST', '/auth/change-password', {
      body: {
        currentPassword: 'oldPassword1',
        newPassword: 'newPassword2',
      },
    });
  });

  it('useChangePassword — 400 Current password is incorrect routes to currentPassword field via applyServerErrorToForm', async () => {
    const wrongPasswordError = new ApiError(
      400,
      SERVER_MESSAGES.currentPasswordIncorrect,
      'api'
    );
    apiRequestSpy.mockRejectedValueOnce(wrongPasswordError);

    const { result } = renderHook(() => useChangePassword(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        currentPassword: 'incorrectPassword',
        newPassword: 'newPassword123',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(wrongPasswordError);

    // Verify integration with applyServerErrorToForm in 'changePassword' context
    const mockForm = { setError: vi.fn() };
    const uiError = applyServerErrorToForm(result.current.error, mockForm, 'changePassword');

    expect(mockForm.setError).toHaveBeenCalledTimes(1);
    expect(mockForm.setError).toHaveBeenCalledWith('currentPassword', {
      type: 'server',
      message: SERVER_MESSAGES.currentPasswordIncorrect,
    });
    expect(mockForm.setError).not.toHaveBeenCalledWith('root', expect.anything());
    expect(uiError.status).toBe(400);
    expect(uiError.message).toBe(SERVER_MESSAGES.currentPasswordIncorrect);
  });

  it('useChangePassword — 400 other server error routes to root via applyServerErrorToForm', async () => {
    const validationError = new ApiError(
      400,
      'New password must contain at least one number',
      'api'
    );
    apiRequestSpy.mockRejectedValueOnce(validationError);

    const { result } = renderHook(() => useChangePassword(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        currentPassword: 'oldPassword123',
        newPassword: 'weakpassword',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    const mockForm = { setError: vi.fn() };
    const uiError = applyServerErrorToForm(result.current.error, mockForm, 'changePassword');

    expect(mockForm.setError).toHaveBeenCalledTimes(1);
    expect(mockForm.setError).toHaveBeenCalledWith('root', {
      type: 'server',
      message: 'New password must contain at least one number',
    });
    expect(uiError.status).toBe(400);
  });

  it('useChangePassword — failure: disables automatic mutation retry', async () => {
    const serverError = new ApiError(500, 'Internal Server Error', 'api');
    apiRequestSpy.mockRejectedValueOnce(serverError);

    const { result } = renderHook(() => useChangePassword(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword123',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Proves retry is disabled (only 1 attempt made)
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(result.current.error).toEqual(serverError);
  });

  it('useChangePassword — custom options: forwards onSuccess and onError callbacks', async () => {
    const onSuccessMock = vi.fn();
    const onErrorMock = vi.fn();

    // Test success callback forwarding
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Password changed',
      data: null,
    });

    const { result } = renderHook(
      () =>
        useChangePassword({
          onSuccess: onSuccessMock,
          onError: onErrorMock,
        }),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    act(() => {
      result.current.mutate({
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword123',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(onSuccessMock).toHaveBeenCalledTimes(1);
    expect(onErrorMock).not.toHaveBeenCalled();

    // Test error callback forwarding
    const failureError = new ApiError(400, 'Current password is incorrect', 'api');
    apiRequestSpy.mockRejectedValueOnce(failureError);

    act(() => {
      result.current.mutate({
        currentPassword: 'wrongPassword',
        newPassword: 'newPassword123',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(onErrorMock).toHaveBeenCalledTimes(1);
  });
});
