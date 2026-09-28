import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStartTicket } from '@/hooks/tickets/useStartTicket';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { Submission, Ticket, TicketWithSubmissions } from '@/types';

function createWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const mockAssignedTicket: Ticket = {
  id: '22222222-2222-4222-8222-222222222222',
  status: 'assigned',
  templateKey: 'react',
  title: 'Fix navigation redirect',
  scenario: 'Open redirects allow arbitrary external destinations.',
  category: 'Security',
  difficulty: 'Medium',
  touchedFiles: ['src/lib/navigation.ts'],
  acceptanceCriteria: ['Prevent open redirects'],
  testChecklist: ['Unit tests pass'],
  branchName: 'fix/navigation',
  repo: {
    fullName: 'octo-org/work-sim',
    defaultBranch: 'main',
  },
  createdAt: '2026-09-24T08:00:00.000Z',
  completedAt: null,
  abandonedAt: null,
};

const mockInProgressTicket: Ticket = {
  ...mockAssignedTicket,
  status: 'in_progress',
};

const mockSubmission: Submission = {
  id: '33333333-3333-4333-8333-333333333331',
  attempt: 1,
  status: 'completed',
  prNumber: 42,
  prUrl: 'https://github.com/octo-org/work-sim/pull/42',
  headSha: 'abc1234',
  ciPassed: true,
  ciRunUrl: 'https://github.com/octo-org/work-sim/actions/runs/1',
  failureReason: null,
  submittedAt: '2026-09-24T09:00:00.000Z',
  evaluation: null,
};

describe('useStartTicket hook (doc 10 §10.9; EP-26; doc 11 §11.2.7, §11.7 & §11.9)', () => {
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

  it('useStartTicket — success: calls EP-26, replaces ticket in queryKeys.ticket(id) while keeping submissions, and invalidates queryKeys.currentTicket', async () => {
    const ticketId = mockAssignedTicket.id;

    // Seed existing ticket cache with assigned status and an existing submission
    queryClient.setQueryData<TicketWithSubmissions>(queryKeys.ticket(ticketId), {
      ticket: mockAssignedTicket,
      submissions: [mockSubmission],
    });

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Ticket started',
      data: { ticket: mockInProgressTicket },
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useStartTicket(ticketId), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isPending).toBe(false);

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // EP-26 POST /tickets/:ticketId/start with no body
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith('POST', `/tickets/${ticketId}/start`);

    // Returns unwrapped ticket
    expect(result.current.data).toEqual(mockInProgressTicket);

    // Replaced ticket in queryKeys.ticket(id) and kept submissions
    const cached = queryClient.getQueryData<TicketWithSubmissions>(
      queryKeys.ticket(ticketId)
    );
    expect(cached?.ticket).toEqual(mockInProgressTicket);
    expect(cached?.submissions).toEqual([mockSubmission]);

    // Invalidates queryKeys.currentTicket
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.currentTicket,
    });

    // Critical negative check: never invalidates broad ['ticket'] prefix
    for (const call of invalidateQueriesSpy.mock.calls) {
      expect(call[0]?.queryKey).not.toEqual(['ticket']);
    }
  });

  it('useStartTicket — success when ticket cache was empty: seeds ticket with empty submissions', async () => {
    const ticketId = mockAssignedTicket.id;

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Ticket started',
      data: { ticket: mockInProgressTicket },
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useStartTicket(ticketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const cached = queryClient.getQueryData<TicketWithSubmissions>(
      queryKeys.ticket(ticketId)
    );
    expect(cached).toEqual({
      ticket: mockInProgressTicket,
      submissions: [],
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.currentTicket,
    });
  });

  it('useStartTicket — does not flip the phase before the response (no optimistic update)', async () => {
    const ticketId = mockAssignedTicket.id;

    // Seed existing ticket cache
    queryClient.setQueryData<TicketWithSubmissions>(queryKeys.ticket(ticketId), {
      ticket: mockAssignedTicket,
      submissions: [],
    });

    let resolveApi!: (value: unknown) => void;
    apiRequestSpy.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveApi = resolve;
      })
    );

    const { result } = renderHook(() => useStartTicket(ticketId), {
      wrapper: createWrapper(queryClient),
    });

    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

    act(() => {
      result.current.mutate();
    });

    // Prior to server response, phase must remain assigned; no optimistic flip
    const midFlight = queryClient.getQueryData<TicketWithSubmissions>(
      queryKeys.ticket(ticketId)
    );
    expect(midFlight?.ticket.status).toBe('assigned');
    expect(setQueryDataSpy).not.toHaveBeenCalled();

    // Now resolve server response
    await act(async () => {
      resolveApi({
        statusCode: 200,
        message: 'Ticket started',
        data: { ticket: mockInProgressTicket },
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Only flips after server response
    const afterSuccess = queryClient.getQueryData<TicketWithSubmissions>(
      queryKeys.ticket(ticketId)
    );
    expect(afterSuccess?.ticket.status).toBe('in_progress');
  });

  it('useStartTicket — 409 conflict: invalidates queryKeys.ticket(id) and queryKeys.currentTicket', async () => {
    const ticketId = mockAssignedTicket.id;
    const conflictError = new ApiError(
      409,
      'This ticket has already been started',
      'api'
    );
    apiRequestSpy.mockRejectedValueOnce(conflictError);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useStartTicket(ticketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(conflictError);

    // 409 invalidates both queryKeys.ticket(id) and queryKeys.currentTicket
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.ticket(ticketId),
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.currentTicket,
    });

    // Critical negative check: never invalidates broad ['ticket'] prefix
    for (const call of invalidateQueriesSpy.mock.calls) {
      expect(call[0]?.queryKey).not.toEqual(['ticket']);
    }
  });

  it('useStartTicket — timeout: invalidates both ticket and currentTicket', async () => {
    const ticketId = mockAssignedTicket.id;
    const timeoutError = new ApiError(0, 'Request timed out', 'timeout');
    apiRequestSpy.mockRejectedValueOnce(timeoutError);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useStartTicket(ticketId), {
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
      queryKey: queryKeys.ticket(ticketId),
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.currentTicket,
    });

    for (const call of invalidateQueriesSpy.mock.calls) {
      expect(call[0]?.queryKey).not.toEqual(['ticket']);
    }
  });

  it('useStartTicket — 408 / 504 timeout status: invalidates both ticket and currentTicket', async () => {
    const ticketId = mockAssignedTicket.id;
    const timeoutError = new ApiError(504, 'Gateway Timeout', 'api');
    apiRequestSpy.mockRejectedValueOnce(timeoutError);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useStartTicket(ticketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.ticket(ticketId),
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.currentTicket,
    });
  });

  it('useStartTicket — 402 / 404 / 500 error: exposes error and does NOT invalidate ticket queries directly in hook', async () => {
    const ticketId = mockAssignedTicket.id;
    const error402 = new ApiError(402, 'An active subscription is required', 'api');
    apiRequestSpy.mockRejectedValueOnce(error402);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useStartTicket(ticketId), {
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
      queryKey: queryKeys.ticket(ticketId),
    });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: queryKeys.currentTicket,
    });
  });

  it('useStartTicket — mutation retry is disabled: never auto-retries', async () => {
    const ticketId = mockAssignedTicket.id;
    const error500 = new ApiError(500, 'Server Error', 'api');
    apiRequestSpy.mockRejectedValueOnce(error500);

    const { result } = renderHook(() => useStartTicket(ticketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Exactly one attempt; mutation retry is disabled
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(result.current.error).toEqual(error500);
  });

  it('useStartTicket — custom options: forwards onSuccess and onError callbacks', async () => {
    const ticketId = mockAssignedTicket.id;
    const onSuccess = vi.fn();
    const onError = vi.fn();

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Ticket started',
      data: { ticket: mockInProgressTicket },
    });

    const { result } = renderHook(
      () => useStartTicket(ticketId, { onSuccess, onError }),
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
      mockInProgressTicket,
      undefined,
      undefined,
      expect.any(Object)
    );
    expect(onError).not.toHaveBeenCalled();
  });

  it('useStartTicket — forwards onError callback on failure', async () => {
    const ticketId = mockAssignedTicket.id;
    const onError = vi.fn();
    const error409 = new ApiError(409, 'This ticket has already been started', 'api');
    apiRequestSpy.mockRejectedValueOnce(error409);

    const { result } = renderHook(() => useStartTicket(ticketId, { onError }), {
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

  it('critical negative test: unrelated ticket caches are untouched and bare ["ticket"] is never invalidated (Doc 11 §11.7 & §11.9)', async () => {
    const ticketId = mockAssignedTicket.id;
    const unrelatedTicketId = '99999999-9999-4999-8999-999999999999';

    // Seed unrelated ticket
    queryClient.setQueryData(queryKeys.ticket(unrelatedTicketId), {
      ticket: { ...mockAssignedTicket, id: unrelatedTicketId },
      submissions: [],
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Ticket started',
      data: { ticket: mockInProgressTicket },
    });

    const { result } = renderHook(() => useStartTicket(ticketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Unrelated ticket cache is still present and valid
    const unrelatedCached = queryClient.getQueryData(queryKeys.ticket(unrelatedTicketId));
    expect(unrelatedCached).toEqual({
      ticket: { ...mockAssignedTicket, id: unrelatedTicketId },
      submissions: [],
    });

    // Bare ['ticket'] was never invalidated
    const invalidations = invalidateQueriesSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidations).not.toContainEqual(['ticket']);
  });
});
