import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSubmitWork } from '@/hooks/submissions/useSubmitWork';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { Submission, Ticket } from '@/types';

function createWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const mockTicketId = '11111111-1111-4111-8111-111111111111';

const mockSubmissionAttempt1: Submission = {
  id: '22222222-2222-4222-8222-222222222221',
  attempt: 1,
  status: 'awaiting_ci',
  prNumber: 42,
  prUrl: 'https://github.com/octo-org/work-sim/pull/42',
  headSha: 'sha-commit-1',
  ciPassed: null,
  ciRunUrl: null,
  failureReason: null,
  submittedAt: '2026-09-29T10:00:00.000Z',
  evaluation: null,
};

const mockSubmissionAttempt2: Submission = {
  id: '33333333-3333-4333-8333-333333333332',
  attempt: 2,
  status: 'awaiting_ci',
  prNumber: 42,
  prUrl: 'https://github.com/octo-org/work-sim/pull/42',
  headSha: 'sha-commit-2',
  ciPassed: null,
  ciRunUrl: null,
  failureReason: null,
  submittedAt: '2026-09-29T11:00:00.000Z',
  evaluation: null,
};

describe('useSubmitWork hook (doc 10 §10.11; EP-30; doc 11 §11.2.9, §11.7 & §11.9)', () => {
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

  it('useSubmitWork — success attempt 1 (Doc 11 §11.2.9 & Doc 10 §10.11): takes no attempt, sends no body, reads attempt from response, sets submission cache, and invalidates ticket & currentTicket', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 202,
      message: 'Submission received',
      data: { submission: mockSubmissionAttempt1 },
    });

    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSubmitWork(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isPending).toBe(false);

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // EP-30 POST /tickets/:ticketId/submissions with no body
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith(
      'POST',
      `/tickets/${mockTicketId}/submissions`
    );

    // Returns unwrapped submission
    expect(result.current.data).toEqual(mockSubmissionAttempt1);
    expect(result.current.data?.attempt).toBe(1);
    expect(result.current.data?.status).toBe('awaiting_ci');

    // Seeds queryKeys.submission(ticketId, submission.attempt, false)
    expect(setQueryDataSpy).toHaveBeenCalledWith(
      queryKeys.submission(mockTicketId, 1, false),
      mockSubmissionAttempt1
    );
    const cached = queryClient.getQueryData<Submission>(
      queryKeys.submission(mockTicketId, 1, false)
    );
    expect(cached).toEqual(mockSubmissionAttempt1);

    // Invalidates ticket and currentTicket
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.ticket(mockTicketId),
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.currentTicket,
    });

    // Critical negative check: bare ['ticket'] is never invalidated
    for (const call of invalidateQueriesSpy.mock.calls) {
      expect(call[0]?.queryKey).not.toEqual(['ticket']);
    }
  });

  it('useSubmitWork — success attempt 2 (resubmission): reads attempt 2 from response and seeds attempt 2 cache', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 202,
      message: 'Submission received',
      data: { submission: mockSubmissionAttempt2 },
    });

    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSubmitWork(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockSubmissionAttempt2);
    expect(result.current.data?.attempt).toBe(2);

    expect(setQueryDataSpy).toHaveBeenCalledWith(
      queryKeys.submission(mockTicketId, 2, false),
      mockSubmissionAttempt2
    );

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.ticket(mockTicketId),
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.currentTicket,
    });
  });

  it('useSubmitWork — 400 no commits found: normal user-fixable error and causes NO cache change (Doc 10 §10.11)', async () => {
    const error400 = new ApiError(
      400,
      "No commits found on branch 'ticket/dark-mode'. Push your work before submitting",
      'api'
    );
    apiRequestSpy.mockRejectedValueOnce(error400);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

    const { result } = renderHook(() => useSubmitWork(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error400);
    // 400 causes NO cache change
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
    expect(setQueryDataSpy).not.toHaveBeenCalled();
  });

  it('useSubmitWork — 409 conflict (stale resubmit, Doc 11 §11.2.9 & Doc 10 §10.11): invalidates ticket, currentTicket, and both non-diff submission keys', async () => {
    const error409 = new ApiError(
      409,
      'Wait for feedback on your first submission before resubmitting',
      'api'
    );
    apiRequestSpy.mockRejectedValueOnce(error409);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSubmitWork(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error409);

    // Invalidates ticket(ticketId), currentTicket, and both submission(ticketId, 1, false) and submission(ticketId, 2, false)
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.ticket(mockTicketId),
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.currentTicket,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.submission(mockTicketId, 1, false),
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.submission(mockTicketId, 2, false),
    });

    // Critical negative check: bare ['ticket'] is never invalidated
    for (const call of invalidateQueriesSpy.mock.calls) {
      expect(call[0]?.queryKey).not.toEqual(['ticket']);
    }
  });

  it('useSubmitWork — timeout error (Doc 11 §11.2.9 & Doc 10 §10.11): invalidates ticket, currentTicket, and both submission keys so refetch catches created submission', async () => {
    const timeoutError = new ApiError(0, 'Request timed out', 'timeout');
    apiRequestSpy.mockRejectedValueOnce(timeoutError);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSubmitWork(mockTicketId), {
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
      queryKey: queryKeys.ticket(mockTicketId),
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.currentTicket,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.submission(mockTicketId, 1, false),
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.submission(mockTicketId, 2, false),
    });
  });

  it('useSubmitWork — 408 / 504 timeout status: invalidates ticket, currentTicket, and both submission keys', async () => {
    const gatewayTimeout = new ApiError(504, 'Gateway Timeout', 'api');
    apiRequestSpy.mockRejectedValueOnce(gatewayTimeout);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSubmitWork(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.ticket(mockTicketId),
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.currentTicket,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.submission(mockTicketId, 1, false),
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.submission(mockTicketId, 2, false),
    });
  });

  it('useSubmitWork — timeout in message: invalidates ticket, currentTicket, and both submission keys', async () => {
    const msgTimeout = new ApiError(500, 'Upstream timeout', 'api');
    apiRequestSpy.mockRejectedValueOnce(msgTimeout);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSubmitWork(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.ticket(mockTicketId),
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.currentTicket,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.submission(mockTicketId, 1, false),
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.submission(mockTicketId, 2, false),
    });
  });

  it('useSubmitWork — other errors (402, 403, 502 reading GitHub): exposes error without invalidation', async () => {
    const error502 = new ApiError(502, 'Could not read your pull request from GitHub, please try again', 'api');
    apiRequestSpy.mockRejectedValueOnce(error502);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSubmitWork(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error502);
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });

  it('useSubmitWork — mutation retry is disabled: never auto-retries mutation on failure (Doc 11 §11.9)', async () => {
    const error500 = new ApiError(500, 'Internal Server Error', 'api');
    apiRequestSpy.mockRejectedValueOnce(error500);

    const { result } = renderHook(() => useSubmitWork(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(result.current.error).toEqual(error500);
  });

  it('useSubmitWork — forwards onSuccess and onError callbacks from options', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 202,
      message: 'Submission received',
      data: { submission: mockSubmissionAttempt1 },
    });

    const { result } = renderHook(
      () => useSubmitWork(mockTicketId, { onSuccess, onError }),
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
      mockSubmissionAttempt1,
      undefined,
      undefined,
      expect.any(Object)
    );
    expect(onError).not.toHaveBeenCalled();
  });

  it('useSubmitWork — forwards onError callback on failure', async () => {
    const onError = vi.fn();
    const error409 = new ApiError(409, 'Conflict', 'api');
    apiRequestSpy.mockRejectedValueOnce(error409);

    const { result } = renderHook(
      () => useSubmitWork(mockTicketId, { onError }),
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

  it('critical negative test: bare ["ticket"] queryKey is NEVER invalidated (Doc 11 §11.7 & §11.9)', async () => {
    const otherTicketId = '99999999-9999-4999-8999-999999999999';
    queryClient.setQueryData(queryKeys.ticket(otherTicketId), {
      ticket: { id: otherTicketId } as Ticket,
      submissions: [],
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 202,
      message: 'Submission received',
      data: { submission: mockSubmissionAttempt1 },
    });

    const { result } = renderHook(() => useSubmitWork(mockTicketId), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Unrelated ticket cache is preserved
    expect(queryClient.getQueryData(queryKeys.ticket(otherTicketId))).toBeDefined();

    // Bare ['ticket'] was never invalidated
    const invalidations = invalidateQueriesSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidations).not.toContainEqual(['ticket']);
  });
});
