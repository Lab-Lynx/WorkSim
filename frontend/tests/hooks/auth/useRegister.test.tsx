import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRegister } from '@/hooks/auth/useRegister';
import * as apiClient from '@/lib/api/client';
import { ApiError, applyServerErrorToForm } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/store/auth.store';
import type { User } from '@/types';
import type { RegisterInput } from '@/schemas/auth.schemas';

function createWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const mockRegisteredUser: User = {
  id: 'usr-reg-1',
  name: 'Taylor Dev',
  email: 'taylor@example.com',
  role: 'student',
  emailVerifiedAt: null,
  createdAt: '2026-09-26T22:00:00.000Z',
};

describe('useRegister hook (doc 10 §10.6; EP-01; doc 11 §11.2.4)', () => {
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

  it('useRegister — success: POST /auth/register, unwraps user, seeds queryKeys.me, updates store, calls resetSessionExpiredGuard', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 201,
      message: 'User registered',
      data: { user: mockRegisteredUser },
    });

    const { result } = renderHook(() => useRegister(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isPending).toBe(false);

    act(() => {
      result.current.mutate({
        name: 'Taylor Dev',
        email: 'taylor@example.com',
        password: 'securePassword123',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith('POST', '/auth/register', {
      body: {
        name: 'Taylor Dev',
        email: 'taylor@example.com',
        password: 'securePassword123',
      },
    });

    // Returns unwrapped domain User object
    expect(result.current.data).toEqual(mockRegisteredUser);

    // Seeds queryKeys.me cache (D-10)
    expect(queryClient.getQueryData<User>(queryKeys.me)).toEqual(mockRegisteredUser);

    // Synchronizes useAuthStore
    expect(useAuthStore.getState().user).toEqual(mockRegisteredUser);

    // Resets session expired guard
    expect(resetGuardSpy).toHaveBeenCalledTimes(1);
  });

  it('useRegister — payload isolation: sends exactly name, email, and password in body', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 201,
      message: 'User registered',
      data: { user: mockRegisteredUser },
    });

    const { result } = renderHook(() => useRegister(), {
      wrapper: createWrapper(queryClient),
    });

    const inputWithExtra = {
      name: 'Taylor Dev',
      email: 'taylor@example.com',
      password: 'securePassword123',
      extraField: 'shouldNotBeSent',
      role: 'admin',
    } as unknown as RegisterInput;

    act(() => {
      result.current.mutate(inputWithExtra);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledWith('POST', '/auth/register', {
      body: {
        name: 'Taylor Dev',
        email: 'taylor@example.com',
        password: 'securePassword123',
      },
    });
  });

  it('useRegister — failure/duplicate: 409 routes to email field via applyServerErrorToForm', async () => {
    const duplicateError = new ApiError(
      409,
      'An account with this email address already exists',
      'api'
    );
    apiRequestSpy.mockRejectedValueOnce(duplicateError);

    const { result } = renderHook(() => useRegister(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        name: 'Taylor Dev',
        email: 'duplicate@example.com',
        password: 'securePassword123',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(duplicateError);

    // Verify applyServerErrorToForm in register context routes 409 to email field
    const mockForm = { setError: vi.fn() };
    const uiError = applyServerErrorToForm(result.current.error, mockForm, 'register');

    expect(mockForm.setError).toHaveBeenCalledTimes(1);
    expect(mockForm.setError).toHaveBeenCalledWith('email', {
      type: 'server',
      message: 'An account with this email address already exists',
    });
    expect(mockForm.setError).not.toHaveBeenCalledWith('root', expect.anything());
    expect(uiError.status).toBe(409);

    // Cache must remain unseeded and store clean
    expect(queryClient.getQueryData(queryKeys.me)).toBeUndefined();
    expect(useAuthStore.getState().user).toBeNull();
    expect(resetGuardSpy).not.toHaveBeenCalled();
  });

  it('useRegister — failure/other: 400 validation error routes to root via applyServerErrorToForm', async () => {
    const validationError = new ApiError(400, 'Password is too weak', 'api');
    apiRequestSpy.mockRejectedValueOnce(validationError);

    const { result } = renderHook(() => useRegister(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        name: 'Taylor Dev',
        email: 'taylor@example.com',
        password: 'weak',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    const mockForm = { setError: vi.fn() };
    const uiError = applyServerErrorToForm(result.current.error, mockForm, 'register');

    expect(mockForm.setError).toHaveBeenCalledTimes(1);
    expect(mockForm.setError).toHaveBeenCalledWith('root', {
      type: 'server',
      message: 'Password is too weak',
    });
    expect(uiError.status).toBe(400);
  });

  it('useRegister — failure: disables automatic mutation retry', async () => {
    const serverError = new ApiError(500, 'Internal Server Error', 'api');
    apiRequestSpy.mockRejectedValue(serverError);

    const { result } = renderHook(() => useRegister(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        name: 'Taylor Dev',
        email: 'taylor@example.com',
        password: 'securePassword123',
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

  it('useRegister — custom options: forwards onSuccess and onError callbacks', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 201,
      message: 'User registered',
      data: { user: mockRegisteredUser },
    });

    const { result } = renderHook(() => useRegister({ onSuccess, onError }), {
      wrapper: createWrapper(queryClient),
    });

    const input = {
      name: 'Taylor Dev',
      email: 'taylor@example.com',
      password: 'securePassword123',
    };

    act(() => {
      result.current.mutate(input);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(
      mockRegisteredUser,
      input,
      undefined,
      expect.anything()
    );

    // Test onError callback
    const error500 = new ApiError(500, 'Server Error', 'api');
    apiRequestSpy.mockRejectedValueOnce(error500);

    act(() => {
      result.current.mutate(input);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error500, input, undefined, expect.anything());
  });
});
