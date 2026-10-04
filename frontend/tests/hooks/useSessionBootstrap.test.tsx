import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSessionBootstrap } from '@/hooks/useSessionBootstrap';
import { useAuthStore } from '@/store/auth.store';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { User } from '@/types';

const mockUser: User = {
  id: 'usr-456',
  name: 'Taylor Dev',
  email: 'taylor@worksim.test',
  role: 'user',
  emailVerifiedAt: '2026-09-10T12:00:00.000Z',
  createdAt: '2026-09-10T12:00:00.000Z',
};

describe('useSessionBootstrap (M-06 / M-07)', () => {
  let apiRequestSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isSessionChecked: false,
    });
    vi.restoreAllMocks();
    apiRequestSpy = vi.spyOn(apiClient, 'apiRequest');
  });

  it('unwraps response.data.user and stores User object in auth store', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Current user',
      data: { user: mockUser },
    });

    const { result } = renderHook(() => useSessionBootstrap());

    expect(result.current).toBe(false);

    await waitFor(() => {
      expect(result.current).toBe(true);
    });

    const storedUser = useAuthStore.getState().user;
    expect(storedUser).toEqual(mockUser);
    expect(storedUser?.id).toBe('usr-456');
    expect(storedUser?.name).toBe('Taylor Dev');
    // Ensure it is NOT wrapped in a nested user field
    expect((storedUser as unknown as { user?: unknown })?.user).toBeUndefined();
    expect(useAuthStore.getState().isSessionChecked).toBe(true);
  });

  it('calls clearAuth and marks session checked when session is expired or 401', async () => {
    apiRequestSpy.mockRejectedValueOnce(new ApiError(401, 'Unauthorized', 'api'));

    const { result } = renderHook(() => useSessionBootstrap());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isSessionChecked).toBe(true);
  });

  it('skips network request if isSessionChecked is already true', async () => {
    useAuthStore.setState({ isSessionChecked: true, user: mockUser });

    const { result } = renderHook(() => useSessionBootstrap());

    expect(result.current).toBe(true);
    expect(apiRequestSpy).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user).toEqual(mockUser);
  });
});
