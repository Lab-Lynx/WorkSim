import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAssignTicket } from '@/hooks/tickets/useAssignTicket';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { Ticket, TicketWithSubmissions } from '@/types';

function createWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const mockAssignedTicket: Ticket = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  status: 'assigned',
  templateKey: 'react',
  title: 'Implement Dark Mode Toggle',
  scenario: 'Users need a theme toggle in the header.',
  category: 'Feature',
  difficulty: 'Medium',
  touchedFiles: ['src/components/ThemeToggle.tsx'],
  acceptanceCriteria: ['Theme switches between light and dark', 'Preference persists in localStorage'],
  testChecklist: ['Unit tests pass', 'Toggle renders correctly'],
  branchName: 'ticket/dark-mode-toggle',
  repo: {
    fullName: 'octo-org/work-sim',
    defaultBranch: 'main',
  },
  createdAt: '2026-09-28T12:00:00.000Z',
  completedAt: null,
  abandonedAt: null,
};

describe('useAssignTicket hook (doc 10 §10.9; EP-23; doc 11 §11.2.7, §11.7 & §11.9)', () => {
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

  it('useAssignTicket — success (Doc 11 §11.2.7): calls EP-23 with no body / no template choice (Q-09), seeds ticket cache with empty submissions, sets currentTicket, and does not navigate', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 201,
      message: 'Ticket assigned',
      data: { ticket: mockAssignedTicket },
    });

    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const initialHref = window.location.href;

    const { result } = renderHook(() => useAssignTicket(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isPending).toBe(false);

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // EP-23 POST /tickets with no body (no template choice, Q-09)
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith('POST', '/tickets');

    // Returns unwrapped Ticket
    expect(result.current.data).toEqual(mockAssignedTicket);

    // Seeds queryKeys.ticket(id) with { ticket, submissions: [] }
    expect(setQueryDataSpy).toHaveBeenCalledWith(
      queryKeys.ticket(mockAssignedTicket.id),
      {
        ticket: mockAssignedTicket,
        submissions: [],
      }
    );
    const cachedTicket = queryClient.getQueryData<TicketWithSubmissions>(
      queryKeys.ticket(mockAssignedTicket.id)
    );
    expect(cachedTicket).toEqual({
      ticket: mockAssignedTicket,
      submissions: [],
    });

    // Sets queryKeys.currentTicket to the newly assigned ticket
    expect(setQueryDataSpy).toHaveBeenCalledWith(
      queryKeys.currentTicket,
      mockAssignedTicket
    );
    const cachedCurrent = queryClient.getQueryData<Ticket>(queryKeys.currentTicket);
    expect(cachedCurrent).toEqual(mockAssignedTicket);

    // Critical negative check: never invalidates broad ['ticket'] prefix
    for (const call of invalidateQueriesSpy.mock.calls) {
      expect(call[0]?.queryKey).not.toEqual(['ticket']);
    }

    // Does not navigate (caller handles navigation to /tickets/:id)
    expect(window.location.href).toBe(initialHref);
  });

  it('useAssignTicket — 409 race (Doc 11 §11.2.7): invalidates queryKeys.currentTicket and queryKeys.githubConnection so winner ticket appears', async () => {
    const error409 = new ApiError(409, 'You already have an active ticket', 'api');
    apiRequestSpy.mockRejectedValueOnce(error409);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAssignTicket(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error409);

    // Invalidates both currentTicket and githubConnection
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.currentTicket,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.githubConnection,
    });

    // Critical negative check: never invalidates broad ['ticket'] prefix
    for (const call of invalidateQueriesSpy.mock.calls) {
      expect(call[0]?.queryKey).not.toEqual(['ticket']);
    }
  });

  it('useAssignTicket — 409 no starter repository yet: invalidates currentTicket and githubConnection', async () => {
    const error409NoRepo = new ApiError(
      409,
      'Create your starter repository before requesting a ticket',
      'api'
    );
    apiRequestSpy.mockRejectedValueOnce(error409NoRepo);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAssignTicket(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error409NoRepo);

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.currentTicket,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.githubConnection,
    });
  });

  it('useAssignTicket — timeout (kind === "timeout"): invalidates currentTicket and githubConnection so refetch catches created ticket', async () => {
    const timeoutError = new ApiError(0, 'Request timed out', 'timeout');
    apiRequestSpy.mockRejectedValueOnce(timeoutError);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAssignTicket(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(timeoutError);

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.currentTicket,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.githubConnection,
    });

    for (const call of invalidateQueriesSpy.mock.calls) {
      expect(call[0]?.queryKey).not.toEqual(['ticket']);
    }
  });

  it('useAssignTicket — 408 / 504 timeout status: invalidates currentTicket and githubConnection', async () => {
    const gatewayTimeoutError = new ApiError(504, 'Gateway Timeout', 'api');
    apiRequestSpy.mockRejectedValueOnce(gatewayTimeoutError);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAssignTicket(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(gatewayTimeoutError);

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.currentTicket,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.githubConnection,
    });
  });

  it('useAssignTicket — timeout in error message: invalidates currentTicket and githubConnection', async () => {
    const timeoutMsgError = new ApiError(500, 'Connection timeout occurred', 'api');
    apiRequestSpy.mockRejectedValueOnce(timeoutMsgError);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAssignTicket(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(timeoutMsgError);

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.currentTicket,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.githubConnection,
    });
  });

  it('useAssignTicket — other errors (402, 403, 502, 500): exposes error and does NOT invalidate currentTicket/githubConnection directly in hook', async () => {
    const error402 = new ApiError(402, 'An active subscription is required', 'api');
    apiRequestSpy.mockRejectedValueOnce(error402);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAssignTicket(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error402);
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: queryKeys.currentTicket,
    });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: queryKeys.githubConnection,
    });
  });

  it('useAssignTicket — 502 generation failure: exposes error and does NOT invalidate directly in hook', async () => {
    const error502 = new ApiError(502, 'Could not generate a ticket, please try again', 'api');
    apiRequestSpy.mockRejectedValueOnce(error502);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAssignTicket(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error502);
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: queryKeys.currentTicket,
    });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: queryKeys.githubConnection,
    });
  });

  it('useAssignTicket — mutation retry is disabled: never auto-retries mutation on failure (Doc 11 §11.9)', async () => {
    const error500 = new ApiError(500, 'Server Error', 'api');
    apiRequestSpy.mockRejectedValueOnce(error500);

    const { result } = renderHook(() => useAssignTicket(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Exactly 1 request; no auto-retry
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(result.current.error).toEqual(error500);
  });

  it('useAssignTicket — forwards onSuccess and onError callbacks from options', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 201,
      message: 'Ticket assigned',
      data: { ticket: mockAssignedTicket },
    });

    const { result } = renderHook(
      () => useAssignTicket({ onSuccess, onError }),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(
      mockAssignedTicket,
      undefined,
      undefined,
      expect.any(Object)
    );
    expect(onError).not.toHaveBeenCalled();
  });

  it('useAssignTicket — forwards onError callback on mutation failure', async () => {
    const onError = vi.fn();
    const error409 = new ApiError(409, 'You already have an active ticket', 'api');
    apiRequestSpy.mockRejectedValueOnce(error409);

    const { result } = renderHook(() => useAssignTicket({ onError }), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      error409,
      undefined,
      undefined,
      expect.any(Object)
    );
  });

  it('critical negative test: bare ["ticket"] queryKey is NEVER invalidated (Doc 11 §11.7 & §11.9)', async () => {
    const unrelatedTicketId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    queryClient.setQueryData(queryKeys.ticket(unrelatedTicketId), {
      ticket: { ...mockAssignedTicket, id: unrelatedTicketId },
      submissions: [],
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 201,
      message: 'Ticket assigned',
      data: { ticket: mockAssignedTicket },
    });

    const { result } = renderHook(() => useAssignTicket(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Unrelated ticket cache is preserved intact
    const unrelatedCache = queryClient.getQueryData(queryKeys.ticket(unrelatedTicketId));
    expect(unrelatedCache).toEqual({
      ticket: { ...mockAssignedTicket, id: unrelatedTicketId },
      submissions: [],
    });

    // Bare ['ticket'] was never invalidated
    const invalidations = invalidateQueriesSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidations).not.toContainEqual(['ticket']);
  });
});
