import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCurrentTicket } from '@/hooks/tickets/useCurrentTicket';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { Ticket } from '@/types';

function createWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const mockActiveTicket: Ticket = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'assigned',
  templateKey: 'react',
  title: 'Fix CSRF token check',
  scenario: 'Requests are missing CSRF validation in edge cases.',
  category: 'Security',
  difficulty: 'Medium',
  touchedFiles: ['src/lib/csrf.ts'],
  acceptanceCriteria: ['Enforce CSRF check on mutating requests'],
  testChecklist: ['Unit tests pass'],
  branchName: 'ticket/csrf-token-check',
  repo: {
    fullName: 'octo-org/work-sim',
    defaultBranch: 'main',
  },
  createdAt: '2026-09-28T10:00:00.000Z',
  completedAt: null,
  abandonedAt: null,
};

describe('useCurrentTicket hook (doc 10 §10.9; EP-24; doc 11 §11.2.7, §11.7 & §11.9)', () => {
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

  it('useCurrentTicket — success with active ticket (Doc 11 §11.2.7): calls EP-24, caches under queryKeys.currentTicket, and returns ticket', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Current ticket',
      data: { ticket: mockActiveTicket },
    });

    const { result } = renderHook(() => useCurrentTicket(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // EP-24 GET /tickets/current
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith('GET', '/tickets/current');

    // Returns unwrapped ticket
    expect(result.current.data).toEqual(mockActiveTicket);

    // Cached under queryKeys.currentTicket
    const cached = queryClient.getQueryData<Ticket | null>(queryKeys.currentTicket);
    expect(cached).toEqual(mockActiveTicket);
  });

  it('useCurrentTicket — success with null (Doc 11 §11.2.7): returns null when no active ticket exists', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Current ticket',
      data: { ticket: null },
    });

    const { result } = renderHook(() => useCurrentTicket(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeNull();
    const cached = queryClient.getQueryData<Ticket | null>(queryKeys.currentTicket);
    expect(cached).toBeNull();
  });

  it('useCurrentTicket — active state is decided by the server (Doc 10 §10.9): faithfully returns any active status', async () => {
    const inProgressTicket: Ticket = {
      ...mockActiveTicket,
      status: 'in_progress',
    };

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Current ticket',
      data: { ticket: inProgressTicket },
    });

    const { result } = renderHook(() => useCurrentTicket(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.status).toBe('in_progress');
    expect(result.current.data).toEqual(inProgressTicket);
  });

  it('useCurrentTicket — 401 unauthenticated: exposes error and never retries', async () => {
    const error401 = new ApiError(401, 'Unauthorized', 'api');
    apiRequestSpy.mockRejectedValue(error401);

    const { result } = renderHook(() => useCurrentTicket(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.status).toBe(401);
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
  });

  it('useCurrentTicket — transient 5xx server error retries once per shouldRetryQuery', async () => {
    const error500 = new ApiError(500, 'Server error', 'api');
    apiRequestSpy
      .mockRejectedValueOnce(error500)
      .mockResolvedValueOnce({
        statusCode: 200,
        message: 'Current ticket',
        data: { ticket: mockActiveTicket },
      });

    const { result } = renderHook(() => useCurrentTicket(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(mockActiveTicket);
  });

  it('useCurrentTicket — forwards custom options such as enabled: false', async () => {
    apiRequestSpy.mockResolvedValue({
      statusCode: 200,
      message: 'Current ticket',
      data: { ticket: mockActiveTicket },
    });

    const { result } = renderHook(() => useCurrentTicket({ enabled: false }), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.isLoading).toBe(false);
    expect(apiRequestSpy).not.toHaveBeenCalled();
  });

  it('critical negative test: exact queryKey queryKeys.currentTicket is used and bare ["ticket"] prefix is never queried alone (Doc 11 §11.7 & §11.9)', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Current ticket',
      data: { ticket: mockActiveTicket },
    });

    const { result } = renderHook(() => useCurrentTicket(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Caches under exact ['ticket', 'current']
    expect(queryClient.getQueryData(['ticket', 'current'])).toEqual(mockActiveTicket);

    // Bare ['ticket'] prefix has NO data
    expect(queryClient.getQueryData(['ticket'])).toBeUndefined();
  });
});
