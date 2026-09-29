import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useVerifyEmail } from '@/hooks/auth/useVerifyEmail';
import * as apiClient from '@/lib/api/client';
import { ApiError, mapApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/store/auth.store';
import type { User } from '@/types';

function createWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const mockUnverifiedUser: User = {
  id: 'usr-123',
  name: 'Alex Student',
  email: 'alex@example.com',
  role: 'student',
  emailVerifiedAt: null,
  createdAt: '2026-09-01T00:00:00.000Z',
};

describe('useVerifyEmail hook (doc 10 §10.6; EP-06; doc 11 §11.2.4)', () => {
  let queryClient: QueryClient;
  let apiRequestSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    useAuthStore.getState().clearAuth();
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

  it('useVerifyEmail — success: POST token, returns emailVerifiedAt, and updates existing me cache', async () => {
    queryClient.setQueryData(queryKeys.me, mockUnverifiedUser);
    useAuthStore.getState().setUser(mockUnverifiedUser);

    const verifiedAt = '2026-09-26T21:00:00.000Z';
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Email verified',
      data: { emailVerifiedAt: verifiedAt },
    });

    const { result } = renderHook(() => useVerifyEmail(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isPending).toBe(false);

    act(() => {
      result.current.mutate({ token: 'valid-verify-token' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith('POST', '/auth/verify-email', {
      body: { token: 'valid-verify-token' },
    });

    expect(result.current.data).toEqual({ emailVerifiedAt: verifiedAt });

    // queryKeys.me cache must be updated with the new emailVerifiedAt
    const cachedUser = queryClient.getQueryData<User>(queryKeys.me);
    expect(cachedUser).toEqual({
      ...mockUnverifiedUser,
      emailVerifiedAt: verifiedAt,
    });

    // useAuthStore user must be synchronized
    expect(useAuthStore.getState().user).toEqual({
      ...mockUnverifiedUser,
      emailVerifiedAt: verifiedAt,
    });
  });

  it('useVerifyEmail — soft success (already verified per D-11): 200 with emailVerifiedAt updates me cache', async () => {
    queryClient.setQueryData(queryKeys.me, mockUnverifiedUser);
    useAuthStore.getState().setUser(mockUnverifiedUser);

    const softVerifiedAt = '2026-09-26T18:00:00.000Z';
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Email already verified',
      data: { emailVerifiedAt: softVerifiedAt },
    });

    const { result } = renderHook(() => useVerifyEmail(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ token: 'reused-verify-token' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({ emailVerifiedAt: softVerifiedAt });

    const cachedUser = queryClient.getQueryData<User>(queryKeys.me);
    expect(cachedUser?.emailVerifiedAt).toBe(softVerifiedAt);
    expect(useAuthStore.getState().user?.emailVerifiedAt).toBe(softVerifiedAt);
  });

  it('useVerifyEmail — uncached me: does not create queryKeys.me cache entry if none existed', async () => {
    // queryKeys.me is not in cache
    expect(queryClient.getQueryData(queryKeys.me)).toBeUndefined();

    const verifiedAt = '2026-09-26T21:00:00.000Z';
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Email verified',
      data: { emailVerifiedAt: verifiedAt },
    });

    const { result } = renderHook(() => useVerifyEmail(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ token: 'valid-verify-token' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Cache entry must NEVER be created if it did not exist before
    expect(queryClient.getQueryData(queryKeys.me)).toBeUndefined();
  });

  it('useVerifyEmail — 410 expired token: surfaces ApiError mapped to request_new_link', async () => {
    const expiredError = new ApiError(410, 'Verification token has expired', 'api');
    apiRequestSpy.mockRejectedValueOnce(expiredError);

    const { result } = renderHook(() => useVerifyEmail(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ token: 'expired-token' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(expiredError);
    expect(result.current.error?.status).toBe(410);

    const uiError = mapApiError(result.current.error);
    expect(uiError.action).toBe('request_new_link');
  });

  it('useVerifyEmail — 400 invalid format: surfaces ApiError', async () => {
    const invalidError = new ApiError(400, 'Invalid verification token format', 'api');
    apiRequestSpy.mockRejectedValueOnce(invalidError);

    const { result } = renderHook(() => useVerifyEmail(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ token: 'invalid-token' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.status).toBe(400);
    expect(result.current.error?.message).toBe('Invalid verification token format');
  });

  it('useVerifyEmail — failure: disables automatic mutation retry', async () => {
    const serverError = new ApiError(500, 'Internal Server Error', 'api');
    apiRequestSpy.mockRejectedValue(serverError);

    const { result } = renderHook(() => useVerifyEmail(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ token: 'retry-test-token' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
  });

  it('useVerifyEmail — does not deduplicate calls (page guarantees one call per load)', async () => {
    apiRequestSpy.mockResolvedValue({
      statusCode: 200,
      message: 'Email verified',
      data: { emailVerifiedAt: '2026-09-26T21:00:00.000Z' },
    });

    const { result } = renderHook(() => useVerifyEmail(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ token: 'token-1' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    act(() => {
      result.current.mutate({ token: 'token-2' });
    });

    await waitFor(() => {
      expect(apiRequestSpy).toHaveBeenCalledTimes(2);
    });
  });

  it('useVerifyEmail — custom options: forwards onSuccess and onError callbacks', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    const verifiedAt = '2026-09-26T21:00:00.000Z';
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Email verified',
      data: { emailVerifiedAt: verifiedAt },
    });

    const { result } = renderHook(() => useVerifyEmail({ onSuccess, onError }), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ token: 'my-token' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(
      { emailVerifiedAt: verifiedAt },
      { token: 'my-token' },
      undefined,
      expect.anything()
    );

    const testError = new ApiError(500, 'Fail', 'api');
    apiRequestSpy.mockRejectedValueOnce(testError);

    act(() => {
      result.current.mutate({ token: 'failing-token' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      testError,
      { token: 'failing-token' },
      undefined,
      expect.anything()
    );
  });
});
