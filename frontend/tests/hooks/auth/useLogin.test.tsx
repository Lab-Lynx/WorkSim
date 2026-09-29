import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLogin } from '@/hooks/auth/useLogin';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/store/auth.store';
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

const mockUnverifiedUser: User = {
  id: 'usr-456',
  name: 'New Student',
  email: 'new@example.com',
  role: 'student',
  emailVerifiedAt: null,
  createdAt: '2026-09-20T00:00:00.000Z',
};

describe('useLogin hook (doc 10 §10.6; EP-02; doc 11 §11.2.4)', () => {
  let queryClient: QueryClient;
  let apiRequestSpy: ReturnType<typeof vi.spyOn>;
  let resetGuardSpy: ReturnType<typeof vi.spyOn>;

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
    resetGuardSpy = vi.spyOn(apiClient, 'resetSessionExpiredGuard');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('useLogin — success: POST credentials, returns unwrapped user, seeds queryKeys.me, updates store, and calls resetSessionExpiredGuard', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Logged in',
      data: { user: mockUser },
    });

    const { result } = renderHook(() => useLogin(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isPending).toBe(false);

    act(() => {
      result.current.mutate({
        email: 'alex@example.com',
        password: 'password123',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith('POST', '/auth/login', {
      body: { email: 'alex@example.com', password: 'password123' },
    });

    // Returns unwrapped domain value User
    expect(result.current.data).toEqual(mockUser);

    // Seeds queryKeys.me cache
    expect(queryClient.getQueryData<User>(queryKeys.me)).toEqual(mockUser);

    // Synchronizes useAuthStore
    expect(useAuthStore.getState().user).toEqual(mockUser);

    // Calls resetSessionExpiredGuard
    expect(resetGuardSpy).toHaveBeenCalledTimes(1);
  });

  it('useLogin — unverified user (Q-04): logs in successfully without checking emailVerifiedAt or blocking', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Logged in',
      data: { user: mockUnverifiedUser },
    });

    const { result } = renderHook(() => useLogin(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        email: 'new@example.com',
        password: 'password123',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockUnverifiedUser);
    expect(queryClient.getQueryData<User>(queryKeys.me)).toEqual(mockUnverifiedUser);
    expect(useAuthStore.getState().user).toEqual(mockUnverifiedUser);
    expect(resetGuardSpy).toHaveBeenCalledTimes(1);
  });

  it('useLogin — 401 wrong credentials: surfaces ApiError without seeding cache or calling resetSessionExpiredGuard', async () => {
    const error401 = new ApiError(401, 'Invalid credentials', 'api');
    apiRequestSpy.mockRejectedValueOnce(error401);

    const { result } = renderHook(() => useLogin(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        email: 'wrong@example.com',
        password: 'badpassword',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(error401);
    expect(result.current.error?.status).toBe(401);

    // Must NOT seed cache or auth store
    expect(queryClient.getQueryData(queryKeys.me)).toBeUndefined();
    expect(useAuthStore.getState().user).toBeNull();

    // Must NOT call resetSessionExpiredGuard on failure
    expect(resetGuardSpy).not.toHaveBeenCalled();
  });

  it('useLogin — failure: disables automatic mutation retry', async () => {
    const serverError = new ApiError(500, 'Internal Server Error', 'api');
    apiRequestSpy.mockRejectedValue(serverError);

    const { result } = renderHook(() => useLogin(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
  });

  it('useLogin — custom options: forwards onSuccess and onError callbacks', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Logged in',
      data: { user: mockUser },
    });

    const { result } = renderHook(() => useLogin({ onSuccess, onError }), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        email: 'alex@example.com',
        password: 'password123',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(
      mockUser,
      { email: 'alex@example.com', password: 'password123' },
      undefined,
      expect.anything()
    );

    // Test onError callback
    const error500 = new ApiError(500, 'Server down', 'api');
    apiRequestSpy.mockRejectedValueOnce(error500);

    act(() => {
      result.current.mutate({
        email: 'alex@example.com',
        password: 'password123',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      error500,
      { email: 'alex@example.com', password: 'password123' },
      undefined,
      expect.anything()
    );
  });
});
