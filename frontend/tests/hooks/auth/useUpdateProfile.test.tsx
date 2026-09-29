import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUpdateProfile } from '@/hooks/auth/useUpdateProfile';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/store/auth.store';
import type { User } from '@/types';

const mockUser: User = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Original Name',
  email: 'test@example.com',
  role: 'user',
  emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const updatedUser: User = {
  ...mockUser,
  name: 'Updated Name',
};

function createWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useUpdateProfile hook (doc 10 §10.6, doc 11 §11.2.4 & §11.7)', () => {
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

    queryClient.setQueryData(queryKeys.me, mockUser);
    useAuthStore.getState().setUser(mockUser);
    apiRequestSpy = vi.spyOn(apiClient, 'apiRequest');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('useUpdateProfile — success: updates queryKeys.me cache and store with updated user data', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Profile updated',
      data: { user: updatedUser },
    });

    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isPending).toBe(false);

    act(() => {
      result.current.mutate({ name: 'Updated Name' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith('PATCH', '/users/me', {
      body: { name: 'Updated Name' },
    });

    expect(result.current.data).toEqual(updatedUser);

    // Cache update of queryKeys.me per doc 11 §11.7
    const cachedUser = queryClient.getQueryData<User>(queryKeys.me);
    expect(cachedUser).toEqual(updatedUser);

    // Auth store sync
    expect(useAuthStore.getState().user).toEqual(updatedUser);
  });

  it('useUpdateProfile — only sends the name in request body', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Profile updated',
      data: { user: updatedUser },
    });

    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(queryClient),
    });

    // Provide an object that might have extra fields at runtime
    const payload = { name: 'Updated Name', unexpected: 'extra-field' } as unknown as {
      name: string;
    };

    act(() => {
      result.current.mutate(payload);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledWith('PATCH', '/users/me', {
      body: { name: 'Updated Name' },
    });
  });

  it('useUpdateProfile — failure: uses no automatic mutation retry and does not corrupt cache', async () => {
    const error500 = new ApiError(500, 'Internal Server Error', 'api');
    apiRequestSpy.mockRejectedValueOnce(error500);

    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ name: 'Failing Name' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Exactly one call — mutation retry is disabled
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(result.current.error).toEqual(error500);

    // queryKeys.me retains previous user data
    expect(queryClient.getQueryData(queryKeys.me)).toEqual(mockUser);
    expect(useAuthStore.getState().user).toEqual(mockUser);
  });

  it('useUpdateProfile — network failure: surfaces ApiError without retrying', async () => {
    const networkError = new ApiError(0, 'Failed to fetch', 'network');
    apiRequestSpy.mockRejectedValueOnce(networkError);

    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ name: 'Network Fail' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(result.current.error).toEqual(networkError);
  });

  it('useUpdateProfile — custom options: forwards onSuccess and onError callbacks', async () => {
    const customOnSuccess = vi.fn();
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Profile updated',
      data: { user: updatedUser },
    });

    const { result } = renderHook(() => useUpdateProfile({ onSuccess: customOnSuccess }), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ name: 'Updated Name' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(customOnSuccess).toHaveBeenCalledTimes(1);
    expect(customOnSuccess).toHaveBeenCalledWith(
      updatedUser,
      { name: 'Updated Name' },
      undefined,
      expect.any(Object)
    );
    expect(queryClient.getQueryData(queryKeys.me)).toEqual(updatedUser);
  });
});
