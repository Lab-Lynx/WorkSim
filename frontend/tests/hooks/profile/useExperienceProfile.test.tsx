import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useExperienceProfile } from '@/hooks/profile/useExperienceProfile';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { ProfileItem } from '@/types';

function createWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const mockProfileItems: ProfileItem[] = [
  {
    ticketId: '11111111-1111-4111-8111-111111111111',
    title: 'Fix authentication cookie expiry',
    category: 'Backend',
    difficulty: 'Intermediate',
    completedAt: '2026-09-28T14:30:00.000Z',
    evaluation: {
      feedback: 'Good implementation of cookie rotation and expiry handling.',
      scores: {
        requirementsMet: 5,
        correctnessTests: 4,
        codeQuality: 4,
        problemSolving: 5,
        total: 18,
      },
      createdAt: '2026-09-28T14:29:00.000Z',
    },
  },
  {
    ticketId: '22222222-2222-4222-8222-222222222222',
    title: 'Implement rate limiter middleware',
    category: 'Backend',
    difficulty: 'Advanced',
    completedAt: '2026-09-25T11:00:00.000Z',
    evaluation: {
      feedback: 'Solid rate limiter implementation.',
      scores: {
        requirementsMet: 4,
        correctnessTests: 4,
        codeQuality: 4,
        problemSolving: 4,
        total: 16,
      },
      createdAt: '2026-09-25T10:59:00.000Z',
    },
  },
];

describe('useExperienceProfile hook (doc 10 §10.12; EP-34; doc 11 §11.2.10, §11.7 & §11.9)', () => {
  let queryClient: QueryClient;
  let apiRequestSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retryDelay: 0,
        },
      },
    });
    apiRequestSpy = vi.spyOn(apiClient, 'apiRequest');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('useExperienceProfile — success: GET /profile, unwraps data.items, and caches under queryKeys.profile (Doc 11 §11.2.10)', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Profile',
      data: { items: mockProfileItems },
    });

    const { result } = renderHook(() => useExperienceProfile(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith('GET', '/profile');

    expect(result.current.data).toEqual(mockProfileItems);
    expect(queryClient.getQueryData<ProfileItem[]>(queryKeys.profile)).toEqual(mockProfileItems);
  });

  it('useExperienceProfile — preserves newest-first order without client-side sorting', async () => {
    const orderedItems: ProfileItem[] = [
      {
        ticketId: '33333333-3333-4333-8333-333333333333',
        title: 'Newest completed ticket',
        category: 'Frontend',
        difficulty: 'Easy',
        completedAt: '2026-09-29T10:00:00.000Z',
        evaluation: {
          feedback: 'Great UI work.',
          scores: { requirementsMet: 5, correctnessTests: 5, codeQuality: 5, problemSolving: 5, total: 20 },
          createdAt: '2026-09-29T09:59:00.000Z',
        },
      },
      {
        ticketId: '11111111-1111-4111-8111-111111111111',
        title: 'Older completed ticket',
        category: 'Backend',
        difficulty: 'Intermediate',
        completedAt: '2026-09-20T10:00:00.000Z',
        evaluation: {
          feedback: 'Good fix.',
          scores: { requirementsMet: 4, correctnessTests: 4, codeQuality: 4, problemSolving: 4, total: 16 },
          createdAt: '2026-09-20T09:59:00.000Z',
        },
      },
    ];

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Profile',
      data: { items: orderedItems },
    });

    const { result } = renderHook(() => useExperienceProfile(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(orderedItems);
    expect(result.current.data?.[0].ticketId).toBe('33333333-3333-4333-8333-333333333333');
    expect(result.current.data?.[1].ticketId).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('useExperienceProfile — no client-side filtering: returns all completed tickets decided by server', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Profile',
      data: { items: mockProfileItems },
    });

    const { result } = renderHook(() => useExperienceProfile(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.map((item) => item.ticketId)).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]);
  });

  it('useExperienceProfile — no client-side pagination: returns all items returned by the API (FR-50, EP-34)', async () => {
    const manyItems: ProfileItem[] = Array.from({ length: 30 }, (_, idx) => ({
      ticketId: `00000000-0000-4000-8000-${String(idx).padStart(12, '0')}`,
      title: `Ticket ${idx}`,
      category: 'Fullstack',
      difficulty: 'Intermediate',
      completedAt: '2026-09-01T12:00:00.000Z',
      evaluation: {
        feedback: `Feedback ${idx}`,
        scores: { requirementsMet: 4, correctnessTests: 4, codeQuality: 4, problemSolving: 4, total: 16 },
        createdAt: '2026-09-01T11:59:00.000Z',
      },
    }));

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Profile',
      data: { items: manyItems },
    });

    const { result } = renderHook(() => useExperienceProfile(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(30);
  });

  it('useExperienceProfile — handles empty completed tickets profile', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Profile',
      data: { items: [] },
    });

    const { result } = renderHook(() => useExperienceProfile(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });

  it('useExperienceProfile — error: surfaces 401 unauthorized and does not retry', async () => {
    const error401 = new ApiError(401, 'Not authenticated', 'api');
    apiRequestSpy.mockRejectedValue(error401);

    const { result } = renderHook(() => useExperienceProfile(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.status).toBe(401);
    expect(result.current.data).toBeUndefined();
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
  });

  it('useExperienceProfile — transient 5xx failure: retries once according to shouldRetryQuery (Doc 11 §11.2.10)', async () => {
    const error500 = new ApiError(500, 'Internal Server Error', 'api');
    apiRequestSpy
      .mockRejectedValueOnce(error500)
      .mockResolvedValueOnce({
        statusCode: 200,
        message: 'Profile',
        data: { items: mockProfileItems },
      });

    const { result } = renderHook(() => useExperienceProfile(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(mockProfileItems);
  });

  it('useExperienceProfile — persistent error: surfaces ApiError after retry exhausted', async () => {
    const networkError = new ApiError(0, 'Network timeout', 'timeout');
    apiRequestSpy.mockRejectedValue(networkError);

    const { result } = renderHook(() => useExperienceProfile(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Retried once per policy then fails
    expect(apiRequestSpy).toHaveBeenCalledTimes(2);
    expect(result.current.error?.status).toBe(0);
    expect(result.current.data).toBeUndefined();
  });

  it('useExperienceProfile — custom options: forwards custom query options', async () => {
    apiRequestSpy.mockResolvedValue({
      statusCode: 200,
      message: 'Profile',
      data: { items: mockProfileItems },
    });

    const { result } = renderHook(() => useExperienceProfile({ enabled: false }), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isLoading).toBe(false);
    expect(apiRequestSpy).not.toHaveBeenCalled();
  });

  it('critical negative test: exact queryKey queryKeys.profile is used and broad ["ticket"] is never invalidated or queried (Doc 11 §11.7 & §11.9)', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Profile',
      data: { items: mockProfileItems },
    });

    const { result } = renderHook(() => useExperienceProfile(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Ensure profile cache entry exists
    expect(queryClient.getQueryState(queryKeys.profile)).toBeDefined();
    expect(queryClient.getQueryState(['profile'])).toBeDefined();

    // Verify broad ticket query key was never touched
    expect(queryClient.getQueryState(['ticket'])).toBeUndefined();

    // Verify invalidations
    for (const call of invalidateQueriesSpy.mock.calls) {
      const filters = call[0];
      if (filters && 'queryKey' in filters) {
        expect(filters.queryKey).not.toEqual(['ticket']);
      }
    }
  });
});
