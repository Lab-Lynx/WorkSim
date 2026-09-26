import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLogout } from '@/hooks/auth/useLogout';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/store/auth.store';
import type { User } from '@/types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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

describe('useLogout hook (doc 10 §10.6; EP-04; doc 11 §11.2.4)', () => {
  let queryClient: QueryClient;
  let apiRequestSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockNavigate.mockReset();
    useAuthStore.getState().setUser(mockUser);
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

  it('useLogout — success: POST /auth/logout, navigates to /login with replace, then clears cache', async () => {
    queryClient.setQueryData(queryKeys.me, mockUser);
    queryClient.setQueryData(queryKeys.subscription, { status: 'active' });

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Logged out',
      data: null,
    });

    const clearSpy = vi.spyOn(queryClient, 'clear');
    let clearCalledWhenNavigating = false;
    mockNavigate.mockImplementation(() => {
      clearCalledWhenNavigating = clearSpy.mock.calls.length > 0;
    });

    const { result } = renderHook(() => useLogout(), {
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
    expect(apiRequestSpy).toHaveBeenCalledWith('POST', '/auth/logout');

    // Navigation must happen first, clearing cache second (A-76)
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/login', {
      replace: true,
    });
    expect(clearCalledWhenNavigating).toBe(false);

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(queryKeys.me)).toBeUndefined();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('useLogout — 401 treated as success: navigates to /login with replace and clears cache', async () => {
    queryClient.setQueryData(queryKeys.me, mockUser);

    const unauthorizedError = new ApiError(401, 'Unauthorized', 'api');
    apiRequestSpy.mockRejectedValueOnce(unauthorizedError);

    const clearSpy = vi.spyOn(queryClient, 'clear');

    const { result } = renderHook(() => useLogout(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/login', {
      replace: true,
    });
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('useLogout — non-401 failure: leaves user logged in, leaves cache untouched, surfaces error', async () => {
    queryClient.setQueryData(queryKeys.me, mockUser);
    const clearSpy = vi.spyOn(queryClient, 'clear');

    const serverError = new ApiError(500, 'Internal Server Error', 'api');
    apiRequestSpy.mockRejectedValueOnce(serverError);

    const { result } = renderHook(() => useLogout(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(serverError);

    // Navigation and cache clear must NOT happen on non-401 failure
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();

    // User must remain logged in and cached
    expect(queryClient.getQueryData(queryKeys.me)).toEqual(mockUser);
    expect(useAuthStore.getState().user).toEqual(mockUser);
  });

  it('useLogout — failure: disables automatic mutation retry', async () => {
    const serverError = new ApiError(500, 'Internal Server Error', 'api');
    apiRequestSpy.mockRejectedValue(serverError);

    const { result } = renderHook(() => useLogout(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
  });

  it('useLogout — custom options: forwards onSuccess and onError callbacks', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Logged out',
      data: null,
    });

    const { result } = renderHook(() => useLogout({ onSuccess, onError }), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(undefined, undefined, undefined, expect.anything());

    // Test onError with non-401 failure
    const error500 = new ApiError(500, 'Internal Server Error', 'api');
    apiRequestSpy.mockRejectedValueOnce(error500);

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error500, undefined, undefined, expect.anything());
  });
});
