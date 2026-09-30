import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRetrySubmission } from '@/hooks/submissions/useRetrySubmission';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import { getTicketPhase } from '@/lib/ticket-phase';
import type { Submission, Ticket, TicketWithSubmissions } from '@/types';

function createWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const mockTicketId = '11111111-1111-4111-8111-111111111111';

const mockTicketSubmittedV1: Ticket = {
  id: mockTicketId,
  status: 'submitted_v1',
  templateKey: 'react',
  title: 'Implement Dark Mode',
  scenario: 'Scenario description',
  category: 'Feature',
  difficulty: 'Medium',
  touchedFiles: ['src/App.tsx'],
  acceptanceCriteria: ['Criteria 1'],
  testChecklist: ['Checklist 1'],
  branchName: 'ticket/dark-mode',
  repo: {
    fullName: 'octo-org/work-sim',
    defaultBranch: 'main',
  },
  createdAt: '2026-09-29T08:00:00.000Z',
  completedAt: null,
  abandonedAt: null,
};

const mockTicketResubmitted: Ticket = {
  ...mockTicketSubmittedV1,
  status: 'resubmitted',
};

const mockFailedSubmissionAttempt1: Submission = {
  id: '22222222-2222-4222-8222-222222222221',
  attempt: 1,
  status: 'failed',
  prNumber: 42,
  prUrl: 'https://github.com/octo-org/work-sim/pull/42',
  headSha: 'sha-commit-1',
  ciPassed: false,
  ciRunUrl: 'https://github.com/octo-org/work-sim/actions/runs/1',
  failureReason: 'CI check failed with exit code 1',
  submittedAt: '2026-09-29T09:00:00.000Z',
  evaluation: null,
};

const mockCompletedSubmissionAttempt1: Submission = {
  ...mockFailedSubmissionAttempt1,
  status: 'completed',
  ciPassed: true,
  failureReason: null,
  evaluation: {
    feedback: 'Good attempt, but fix the edge cases',
    scores: null,
    createdAt: '2026-09-29T09:15:00.000Z',
  },
};

const mockFailedSubmissionAttempt2: Submission = {
  id: '33333333-3333-4333-8333-333333333332',
  attempt: 2,
  status: 'failed',
  prNumber: 42,
  prUrl: 'https://github.com/octo-org/work-sim/pull/42',
  headSha: 'sha-commit-2',
  ciPassed: false,
  ciRunUrl: 'https://github.com/octo-org/work-sim/actions/runs/2',
  failureReason: 'Evaluation timed out',
  submittedAt: '2026-09-29T11:00:00.000Z',
  evaluation: null,
};

const mockRetriedSubmissionAttempt1: Submission = {
  ...mockFailedSubmissionAttempt1,
  status: 'awaiting_ci',
  failureReason: null,
};

const mockRetriedSubmissionAttempt2: Submission = {
  ...mockFailedSubmissionAttempt2,
  status: 'awaiting_ci',
  failureReason: null,
};

describe('useRetrySubmission hook (doc 10 §10.11; EP-32; doc 11 §11.2.9, §11.7 & §11.9)', () => {
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

  it('useRetrySubmission — attempt comes from TicketPhaseInfo.retryAttempt for attempt 1 (Doc 11 §11.2.9 & Doc 10 §10.11)', async () => {
    // Derive retryAttempt from phase info, never user-chosen
    const phaseInfo = getTicketPhase(mockTicketSubmittedV1, [mockFailedSubmissionAttempt1]);
    expect(phaseInfo.key).toBe('first_review_failed');
    expect(phaseInfo.retryAttempt).toBe(1);

    // Seed existing ticket cache with ticket status submitted_v1
    queryClient.setQueryData<TicketWithSubmissions>(queryKeys.ticket(mockTicketId), {
      ticket: mockTicketSubmittedV1,
      submissions: [mockFailedSubmissionAttempt1],
    });

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 202,
      message: 'Retry started',
      data: { submission: mockRetriedSubmissionAttempt1 },
    });

    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRetrySubmission(mockTicketId, phaseInfo.retryAttempt!), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isPending).toBe(false);

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // EP-32 POST /tickets/:ticketId/submissions/:attempt/retry with no body
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith(
      'POST',
      `/tickets/${mockTicketId}/submissions/1/retry`
    );

    // Returns unwrapped submission
    expect(result.current.data).toEqual(mockRetriedSubmissionAttempt1);

    // Seeds queryKeys.submission(ticketId, attempt, false) with returned submission
    expect(setQueryDataSpy).toHaveBeenCalledWith(
      queryKeys.submission(mockTicketId, 1, false),
      mockRetriedSubmissionAttempt1
    );
    const cachedSubmission = queryClient.getQueryData<Submission>(
      queryKeys.submission(mockTicketId, 1, false)
    );
    expect(cachedSubmission).toEqual(mockRetriedSubmissionAttempt1);

    // Invalidates queryKeys.ticket(ticketId)
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.ticket(mockTicketId),
    });

    // Retry never changes ticket status: status remains submitted_v1
    const cachedTicket = queryClient.getQueryData<TicketWithSubmissions>(
      queryKeys.ticket(mockTicketId)
    );
    expect(cachedTicket?.ticket.status).toBe('submitted_v1');

    // Status returns to processing ('awaiting_ci') so polling can resume
    expect(result.current.data?.status).toBe('awaiting_ci');

    // Critical negative check: bare ['ticket'] is never invalidated
    for (const call of invalidateQueriesSpy.mock.calls) {
      expect(call[0]?.queryKey).not.toEqual(['ticket']);
    }
  });

  it('useRetrySubmission — attempt comes from TicketPhaseInfo.retryAttempt for attempt 2 (Doc 11 §11.2.9 & Doc 10 §10.11)', async () => {
    // Derive retryAttempt from phase info for attempt 2
    const phaseInfo = getTicketPhase(mockTicketResubmitted, [
      mockCompletedSubmissionAttempt1,
      mockFailedSubmissionAttempt2,
    ]);
    expect(phaseInfo.key).toBe('final_review_failed');
    expect(phaseInfo.retryAttempt).toBe(2);

    queryClient.setQueryData<TicketWithSubmissions>(queryKeys.ticket(mockTicketId), {
      ticket: mockTicketResubmitted,
      submissions: [mockCompletedSubmissionAttempt1, mockFailedSubmissionAttempt2],
    });

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 202,
      message: 'Retry started',
      data: { submission: mockRetriedSubmissionAttempt2 },
    });

    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRetrySubmission(mockTicketId, phaseInfo.retryAttempt!), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // EP-32 POST /tickets/:ticketId/submissions/2/retry with no body
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith(
      'POST',
      `/tickets/${mockTicketId}/submissions/2/retry`
    );

    expect(setQueryDataSpy).toHaveBeenCalledWith(
      queryKeys.submission(mockTicketId, 2, false),
      mockRetriedSubmissionAttempt2
    );

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.ticket(mockTicketId),
    });

    // Ticket status remains resubmitted
    const cachedTicket = queryClient.getQueryData<TicketWithSubmissions>(
      queryKeys.ticket(mockTicketId)
    );
    expect(cachedTicket?.ticket.status).toBe('resubmitted');
    expect(result.current.data?.status).toBe('awaiting_ci');
  });

  it('useRetrySubmission — 409 conflict (Doc 11 §11.2.9 & Doc 10 §10.11): invalidates queryKeys.submission and queryKeys.ticket', async () => {
    const error409 = new ApiError(
      409,
      'Only a failed submission can be retried',
      'api'
    );
    apiRequestSpy.mockRejectedValueOnce(error409);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRetrySubmission(mockTicketId, 1), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error409);

    // Invalidates both queryKeys.submission(ticketId, attempt, false) and queryKeys.ticket(ticketId)
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.submission(mockTicketId, 1, false),
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.ticket(mockTicketId),
    });

    // Critical negative check: bare ['ticket'] is never invalidated
    for (const call of invalidateQueriesSpy.mock.calls) {
      expect(call[0]?.queryKey).not.toEqual(['ticket']);
    }
  });

  it('useRetrySubmission — timeout error (Doc 10 §10.11): invalidates queryKeys.submission and queryKeys.ticket', async () => {
    const timeoutError = new ApiError(0, 'Request timed out', 'timeout');
    apiRequestSpy.mockRejectedValueOnce(timeoutError);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRetrySubmission(mockTicketId, 1), {
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
      queryKey: queryKeys.submission(mockTicketId, 1, false),
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.ticket(mockTicketId),
    });
  });

  it('useRetrySubmission — 408 / 504 timeout status: invalidates queryKeys.submission and queryKeys.ticket', async () => {
    const gatewayTimeoutError = new ApiError(504, 'Gateway Timeout', 'api');
    apiRequestSpy.mockRejectedValueOnce(gatewayTimeoutError);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRetrySubmission(mockTicketId, 1), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.submission(mockTicketId, 1, false),
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.ticket(mockTicketId),
    });
  });

  it('useRetrySubmission — timeout in message: invalidates queryKeys.submission and queryKeys.ticket', async () => {
    const msgTimeoutError = new ApiError(500, 'Upstream timeout occurred', 'api');
    apiRequestSpy.mockRejectedValueOnce(msgTimeoutError);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRetrySubmission(mockTicketId, 1), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.submission(mockTicketId, 1, false),
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.ticket(mockTicketId),
    });
  });

  it('useRetrySubmission — other errors (402, 404, 502, 500): exposes error and does NOT invalidate cache directly', async () => {
    const error402 = new ApiError(402, 'An active subscription is required', 'api');
    apiRequestSpy.mockRejectedValueOnce(error402);

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useRetrySubmission(mockTicketId, 1), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(error402);
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });

  it('useRetrySubmission — mutation retry is disabled: never auto-retries on failure (Doc 11 §11.9)', async () => {
    const error500 = new ApiError(500, 'Server Error', 'api');
    apiRequestSpy.mockRejectedValueOnce(error500);

    const { result } = renderHook(() => useRetrySubmission(mockTicketId, 1), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Called exactly once; mutation retry is disabled
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(result.current.error).toEqual(error500);
  });

  it('useRetrySubmission — forwards onSuccess and onError callbacks from options', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 202,
      message: 'Retry started',
      data: { submission: mockRetriedSubmissionAttempt1 },
    });

    const { result } = renderHook(
      () => useRetrySubmission(mockTicketId, 1, { onSuccess, onError }),
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
      mockRetriedSubmissionAttempt1,
      undefined,
      undefined,
      expect.any(Object)
    );
    expect(onError).not.toHaveBeenCalled();
  });

  it('useRetrySubmission — forwards onError callback on failure', async () => {
    const onError = vi.fn();
    const error409 = new ApiError(409, 'Only a failed submission can be retried', 'api');
    apiRequestSpy.mockRejectedValueOnce(error409);

    const { result } = renderHook(
      () => useRetrySubmission(mockTicketId, 1, { onError }),
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

  it('critical negative test: unrelated submissions are untouched and bare ["ticket"] is never invalidated (Doc 11 §11.7 & §11.9)', async () => {
    const otherTicketId = '99999999-9999-4999-8999-999999999999';
    queryClient.setQueryData(
      queryKeys.submission(otherTicketId, 1, false),
      mockFailedSubmissionAttempt1
    );

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 202,
      message: 'Retry started',
      data: { submission: mockRetriedSubmissionAttempt1 },
    });

    const { result } = renderHook(() => useRetrySubmission(mockTicketId, 1), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Unrelated submission data is untouched
    const otherCached = queryClient.getQueryData(
      queryKeys.submission(otherTicketId, 1, false)
    );
    expect(otherCached).toEqual(mockFailedSubmissionAttempt1);

    // Bare ['ticket'] was never invalidated
    const invalidations = invalidateQueriesSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidations).not.toContainEqual(['ticket']);
  });
});
