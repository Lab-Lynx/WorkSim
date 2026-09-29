import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAbandonTicket } from '@/hooks/tickets/useAbandonTicket';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { AbandonResult, Ticket } from '@/types';

function createWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const mockNewTicket: Ticket = {
  id: '22222222-2222-4222-8222-222222222222',
  status: 'assigned',
  templateKey: 'react',
  title: 'Implement Dark Mode Toggle',
  scenario: 'A user wants a dark mode toggle',
  category: 'Feature',
  difficulty: 'intermediate',
  touchedFiles: ['src/components/ThemeToggle.tsx'],
  acceptanceCriteria: ['Toggle switches theme'],
  testChecklist: ['Unit test passes'],
  branchName: 'ticket/ticket-new-456',
  repo: {
    fullName: 'octocat/work-simulator',
    defaultBranch: 'main',
  },
  createdAt: '2026-09-28T12:00:00.000Z',
  completedAt: null,
  abandonedAt: null,
};

describe('useAbandonTicket hook (doc 10 §10.9; EP-27; doc 11 §11.2.7, §11.7 & §11.9)', () => {
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

  it('useAbandonTicket — success with new replacement ticket: calls EP-27, invalidates abandoned ticket, seeds new ticket cache, sets currentTicket, and does not navigate', async () => {
    const abandonedTicketId = '11111111-1111-4111-8111-111111111111';
    const mockResult: AbandonResult = {
      abandonedTicketId,
      newTicket: mockNewTicket,
    };

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Ticket abandoned',
      data: mockResult,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');
    const initialHref = window.location.href;

    const { result } = renderHook(() => useAbandonTicket(abandonedTicketId), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isPending).toBe(false);

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // EP-27 POST /tickets/:ticketId/abandon with no body
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith(
      'POST',
      `/tickets/${abandonedTicketId}/abandon`
    );

    // Returns AbandonResult
    expect(result.current.data).toEqual(mockResult);

    // Invalidates queryKeys.ticket(abandonedTicketId)
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.ticket(abandonedTicketId),
    });

    // Seeds queryKeys.ticket(newTicket.id) with { ticket: newTicket, submissions: [] }
    expect(setQueryDataSpy).toHaveBeenCalledWith(
      queryKeys.ticket(mockNewTicket.id),
      {
        ticket: mockNewTicket,
        submissions: [],
      }
    );

    // Sets queryKeys.currentTicket to newTicket
    expect(setQueryDataSpy).toHaveBeenCalledWith(
      queryKeys.currentTicket,
      mockNewTicket
    );

    // Critical negative check: never invalidates broad ['ticket'] prefix
    for (const call of invalidateQueriesSpy.mock.calls) {
      expect(call[0]?.queryKey).not.toEqual(['ticket']);
    }

    // Does not navigate (TicketPage handles navigation)
    expect(window.location.href).toBe(initialHref);
  });

  it('useAbandonTicket — success with newTicket: null is a successful abandon (A-31 of Doc 5), not an error: sets currentTicket to null and invalidates it', async () => {
    const abandonedTicketId = '11111111-1111-4111-8111-111111111111';
    const mockResult: AbandonResult = {
      abandonedTicketId,
      newTicket: null,
    };

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Ticket abandoned',
      data: mockResult,
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');
    const initialHref = window.location.href;

    const { result } = renderHook(() => useAbandonTicket(abandonedTicketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Valid 200 response with null newTicket
    expect(result.current.data).toEqual(mockResult);
    expect(result.current.isError).toBe(false);

    // Invalidates queryKeys.ticket(abandonedTicketId)
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.ticket(abandonedTicketId),
    });

    // Sets queryKeys.currentTicket to null, then invalidates it
    expect(setQueryDataSpy).toHaveBeenCalledWith(queryKeys.currentTicket, null);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.currentTicket,
    });

    // Does not seed any new ticket key
    expect(setQueryDataSpy).not.toHaveBeenCalledWith(
      expect.arrayContaining(['ticket']),
      expect.objectContaining({ submissions: [] })
    );

    // Critical negative check: never invalidates broad ['ticket'] prefix
    for (const call of invalidateQueriesSpy.mock.calls) {
      expect(call[0]?.queryKey).not.toEqual(['ticket']);
    }

    // Does not navigate
    expect(window.location.href).toBe(initialHref);
  });

  it('useAbandonTicket — 409 conflict: invalidates queryKeys.ticket(ticketId) and queryKeys.currentTicket', async () => {
    const ticketId = '11111111-1111-4111-8111-111111111111';
    const conflictError = new ApiError(
      409,
      'A ticket cannot be abandoned after it has been submitted',
      'api'
    );
    apiRequestSpy.mockRejectedValueOnce(conflictError);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAbandonTicket(ticketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(conflictError);

    // Status 409 invalidates both ticket(ticketId) and currentTicket
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

  it('useAbandonTicket — timeout: invalidates queryKeys.ticket(ticketId) and queryKeys.currentTicket', async () => {
    const ticketId = '11111111-1111-4111-8111-111111111111';
    const timeoutError = new ApiError(0, 'Request timed out', 'timeout');
    apiRequestSpy.mockRejectedValueOnce(timeoutError);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAbandonTicket(ticketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(timeoutError);

    // Timeout invalidates both ticket(ticketId) and currentTicket
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

  it('useAbandonTicket — 408 / 504 timeout status: invalidates ticket and currentTicket', async () => {
    const ticketId = '11111111-1111-4111-8111-111111111111';
    const timeoutError = new ApiError(504, 'Gateway Timeout', 'api');
    apiRequestSpy.mockRejectedValueOnce(timeoutError);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAbandonTicket(ticketId), {
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

  it('useAbandonTicket — 402 / 403 / 500 error: exposes error and does NOT invalidate ticket queries directly in hook', async () => {
    const ticketId = '11111111-1111-4111-8111-111111111111';
    const error402 = new ApiError(402, 'An active subscription is required', 'api');
    apiRequestSpy.mockRejectedValueOnce(error402);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useAbandonTicket(ticketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error402);
    // Does not invalidate ticket or currentTicket for 402
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: queryKeys.ticket(ticketId),
    });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: queryKeys.currentTicket,
    });
  });

  it('useAbandonTicket — mutation retry is disabled: never auto-retries', async () => {
    const ticketId = '11111111-1111-4111-8111-111111111111';
    const error500 = new ApiError(500, 'Server Error', 'api');
    apiRequestSpy.mockRejectedValueOnce(error500);

    const { result } = renderHook(() => useAbandonTicket(ticketId), {
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

  it('useAbandonTicket — custom options: forwards onSuccess and onError callbacks', async () => {
    const ticketId = '11111111-1111-4111-8111-111111111111';
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const mockResult: AbandonResult = {
      abandonedTicketId: ticketId,
      newTicket: mockNewTicket,
    };

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Ticket abandoned',
      data: mockResult,
    });

    const { result } = renderHook(
      () => useAbandonTicket(ticketId, { onSuccess, onError }),
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
      mockResult,
      undefined,
      undefined,
      expect.any(Object)
    );
    expect(onError).not.toHaveBeenCalled();
  });

  it('useAbandonTicket — forwards onError callback on failure', async () => {
    const ticketId = '11111111-1111-4111-8111-111111111111';
    const onError = vi.fn();
    const error409 = new ApiError(
      409,
      'A ticket cannot be abandoned after it has been submitted',
      'api'
    );
    apiRequestSpy.mockRejectedValueOnce(error409);

    const { result } = renderHook(
      () => useAbandonTicket(ticketId, { onError }),
      {
        wrapper: createWrapper(queryClient),
      }
    );

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
    const ticketId = '11111111-1111-4111-8111-111111111111';
    const unrelatedTicketId = '99999999-9999-4999-8999-999999999999';

    // Seed unrelated ticket
    queryClient.setQueryData(queryKeys.ticket(unrelatedTicketId), {
      ticket: { ...mockNewTicket, id: unrelatedTicketId },
      submissions: [],
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Ticket abandoned',
      data: {
        abandonedTicketId: ticketId,
        newTicket: mockNewTicket,
      },
    });

    const { result } = renderHook(() => useAbandonTicket(ticketId), {
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
      ticket: { ...mockNewTicket, id: unrelatedTicketId },
      submissions: [],
    });

    // Bare ['ticket'] was never invalidated
    const invalidations = invalidateQueriesSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidations).not.toContainEqual(['ticket']);
  });
});
