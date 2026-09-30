import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSubmission } from '@/hooks/submissions/useSubmission';
import * as apiClient from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import {
  SUBMISSION_POLL_FAST_MS,
  SUBMISSION_POLL_SLOW_MS,
  SUBMISSION_POLL_SLOW_AFTER_MS,
  SUBMISSION_POLL_STOP_AFTER_MS,
} from '@/config/app.config';
import type { Submission } from '@/types';

function createWrapper(client: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const mockTicketId = '11111111-1111-4111-8111-111111111111';

const mockAwaitingCiSubmission: Submission = {
  id: '22222222-2222-4222-8222-222222222221',
  attempt: 1,
  status: 'awaiting_ci',
  prNumber: 42,
  prUrl: 'https://github.com/octo-org/work-sim/pull/42',
  headSha: 'sha-1',
  ciPassed: null,
  ciRunUrl: null,
  failureReason: null,
  submittedAt: '2026-09-29T10:00:00.000Z',
  evaluation: null,
};

const mockEvaluatingSubmission: Submission = {
  ...mockAwaitingCiSubmission,
  status: 'evaluating',
  ciPassed: true,
  ciRunUrl: 'https://github.com/octo-org/work-sim/actions/runs/1',
};

const mockCompletedSubmission: Submission = {
  ...mockAwaitingCiSubmission,
  status: 'completed',
  ciPassed: true,
  ciRunUrl: 'https://github.com/octo-org/work-sim/actions/runs/1',
  evaluation: {
    feedback: 'Good work',
    scores: null,
    createdAt: '2026-09-29T10:05:00.000Z',
  },
};

const mockFailedSubmission: Submission = {
  ...mockAwaitingCiSubmission,
  status: 'failed',
  ciPassed: false,
  failureReason: 'CI failed',
};

const mockSubmissionWithDiff: Submission = {
  ...mockCompletedSubmission,
  diff: '--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new',
};

describe('useSubmission hook (doc 10 §10.11; EP-31; doc 11 §11.2.9, §11.6, §11.7 & §11.9)', () => {
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

  it('useSubmission — idle for completed submission (Doc 11 §11.2.9): does not poll continuously', async () => {
    apiRequestSpy.mockResolvedValue({
      statusCode: 200,
      message: 'Submission',
      data: { submission: mockCompletedSubmission },
    });

    const { result } = renderHook(() => useSubmission(mockTicketId, 1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.query.isSuccess).toBe(true);
    });

    expect(result.current.query.data).toEqual(mockCompletedSubmission);
    expect(result.current.showSlowHint).toBe(false);
    expect(result.current.pollingStopped).toBe(false);
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);

    // Advance by several intervals
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    // Does not poll because status is completed (terminal)
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
  });

  it('useSubmission — idle for failed submission (Doc 11 §11.2.9): does not poll continuously', async () => {
    apiRequestSpy.mockResolvedValue({
      statusCode: 200,
      message: 'Submission',
      data: { submission: mockFailedSubmission },
    });

    const { result } = renderHook(() => useSubmission(mockTicketId, 1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.query.isSuccess).toBe(true);
    });

    expect(result.current.query.data).toEqual(mockFailedSubmission);
    expect(result.current.showSlowHint).toBe(false);
    expect(result.current.pollingStopped).toBe(false);
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);

    // Advance by several intervals
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    // Does not poll because status is failed (terminal)
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
  });

  it('useSubmission — fast polling (Doc 11 §11.2.9 & §11.6): polls every SUBMISSION_POLL_FAST_MS while processing', async () => {
    apiRequestSpy.mockResolvedValue({
      statusCode: 200,
      message: 'Submission',
      data: { submission: mockAwaitingCiSubmission },
    });

    const { result } = renderHook(() => useSubmission(mockTicketId, 1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.query.isSuccess).toBe(true);
    });

    // Initial fetch
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith(
      'GET',
      `/tickets/${mockTicketId}/submissions/1`,
      undefined
    );

    // First interval: SUBMISSION_POLL_FAST_MS (3000ms)
    await act(async () => {
      vi.advanceTimersByTime(SUBMISSION_POLL_FAST_MS);
    });

    await waitFor(() => {
      expect(apiRequestSpy).toHaveBeenCalledTimes(2);
    });

    // Repeated interval: another 3000ms
    await act(async () => {
      vi.advanceTimersByTime(SUBMISSION_POLL_FAST_MS);
    });

    await waitFor(() => {
      expect(apiRequestSpy).toHaveBeenCalledTimes(3);
    });

    expect(result.current.showSlowHint).toBe(false);
    expect(result.current.pollingStopped).toBe(false);
  });

  it('useSubmission — slow polling (Doc 11 §11.2.9 & §11.6): boundary cases around SUBMISSION_POLL_SLOW_AFTER_MS', async () => {
    apiRequestSpy.mockResolvedValue({
      statusCode: 200,
      message: 'Submission',
      data: { submission: mockAwaitingCiSubmission },
    });

    const { result } = renderHook(() => useSubmission(mockTicketId, 1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.query.isSuccess).toBe(true);
    });

    // Just before switch: advance up to just before 120,000ms
    await act(async () => {
      vi.advanceTimersByTime(SUBMISSION_POLL_SLOW_AFTER_MS - 1000);
    });

    expect(result.current.showSlowHint).toBe(false);

    // At / after switch: advance past 120,000ms
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.showSlowHint).toBe(true);
    expect(result.current.pollingStopped).toBe(false);

    // After switch: polling interval switches to SUBMISSION_POLL_SLOW_MS (10,000ms)
    const callsAtSlowSwitch = apiRequestSpy.mock.calls.length;

    // Advance by half of slow interval (fast interval would have fired, but slow should not yet fire)
    await act(async () => {
      vi.advanceTimersByTime(SUBMISSION_POLL_SLOW_MS / 2);
    });
    expect(apiRequestSpy).toHaveBeenCalledTimes(callsAtSlowSwitch);

    // Advance remaining half to complete SUBMISSION_POLL_SLOW_MS
    await act(async () => {
      vi.advanceTimersByTime(SUBMISSION_POLL_SLOW_MS / 2);
    });
    await waitFor(() => {
      expect(apiRequestSpy).toHaveBeenCalledTimes(callsAtSlowSwitch + 1);
    });
  });

  it('useSubmission — polling stop (Doc 11 §11.2.9 & §11.6): boundary cases around SUBMISSION_POLL_STOP_AFTER_MS', async () => {
    apiRequestSpy.mockResolvedValue({
      statusCode: 200,
      message: 'Submission',
      data: { submission: mockEvaluatingSubmission },
    });

    const { result } = renderHook(() => useSubmission(mockTicketId, 1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.query.isSuccess).toBe(true);
    });

    // Advance to just before stop: advance up to just before 600,000ms
    await act(async () => {
      vi.advanceTimersByTime(SUBMISSION_POLL_STOP_AFTER_MS - 2000);
    });

    expect(result.current.pollingStopped).toBe(false);

    // At / after stop: advance past 600,000ms
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.pollingStopped).toBe(true);

    const callsAtStop = apiRequestSpy.mock.calls.length;

    // Advance past stop
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    // No further polling occurs after stop
    expect(apiRequestSpy).toHaveBeenCalledTimes(callsAtStop);
  });

  it('useSubmission — restart (Doc 11 §11.2.9): restartPolling clears stopped flag, restarts timers, and refetches', async () => {
    apiRequestSpy.mockResolvedValue({
      statusCode: 200,
      message: 'Submission',
      data: { submission: mockAwaitingCiSubmission },
    });

    const { result } = renderHook(() => useSubmission(mockTicketId, 1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.query.isSuccess).toBe(true);
    });

    // Advance to stopped state (600,000ms)
    await act(async () => {
      vi.advanceTimersByTime(SUBMISSION_POLL_STOP_AFTER_MS);
    });

    expect(result.current.pollingStopped).toBe(true);
    const callsBeforeRestart = apiRequestSpy.mock.calls.length;

    // Call restartPolling()
    await act(async () => {
      result.current.restartPolling();
    });

    // Immediately refetches
    await waitFor(() => {
      expect(apiRequestSpy).toHaveBeenCalledTimes(callsBeforeRestart + 1);
    });

    // Polling flags reset
    expect(result.current.pollingStopped).toBe(false);
    expect(result.current.showSlowHint).toBe(false);

    // Fast polling resumes from defined initial interval (3000ms)
    await act(async () => {
      vi.advanceTimersByTime(SUBMISSION_POLL_FAST_MS);
    });

    await waitFor(() => {
      expect(apiRequestSpy).toHaveBeenCalledTimes(callsBeforeRestart + 2);
    });
  });

  it('useSubmission — diff query (Doc 11 §11.2.9 & Doc 10 §10.11): requests diff only when includeDiff is true, uses queryKeys.submission(id, attempt, true), and disables window focus refetch & polling', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Submission',
      data: { submission: mockSubmissionWithDiff },
    });

    const { result } = renderHook(
      () => useSubmission(mockTicketId, 1, { includeDiff: true }),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    await waitFor(() => {
      expect(result.current.query.isSuccess).toBe(true);
    });

    // Requests diff: ?includeDiff=true
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(apiRequestSpy).toHaveBeenCalledWith(
      'GET',
      `/tickets/${mockTicketId}/submissions/1`,
      { query: { includeDiff: true } }
    );

    expect(result.current.query.data?.diff).toBe(mockSubmissionWithDiff.diff);

    // Exact key: queryKeys.submission(id, attempt, true)
    const cachedDiff = queryClient.getQueryData<Submission>(
      queryKeys.submission(mockTicketId, 1, true)
    );
    expect(cachedDiff).toEqual(mockSubmissionWithDiff);

    // Non-diff key has not been seeded
    expect(
      queryClient.getQueryData(queryKeys.submission(mockTicketId, 1, false))
    ).toBeUndefined();

    // No polling occurs for diff query
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(result.current.showSlowHint).toBe(false);
    expect(result.current.pollingStopped).toBe(false);
  });

  it('useSubmission — disabled while ticketId is undefined (Doc 10 §10.11)', async () => {
    const { result } = renderHook(() => useSubmission(undefined, 1), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.query.fetchStatus).toBe('idle');
    expect(result.current.query.data).toBeUndefined();
    expect(result.current.showSlowHint).toBe(false);
    expect(result.current.pollingStopped).toBe(false);
    expect(apiRequestSpy).not.toHaveBeenCalled();
  });

  it('useSubmission — transition to terminal status clears timers and halts polling', async () => {
    apiRequestSpy
      .mockResolvedValueOnce({
        statusCode: 200,
        message: 'Submission',
        data: { submission: mockAwaitingCiSubmission },
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        message: 'Submission',
        data: { submission: mockCompletedSubmission },
      });

    const { result } = renderHook(() => useSubmission(mockTicketId, 1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.query.data?.status).toBe('awaiting_ci');
    });

    // Advance 3000ms: poll returns completed submission
    await act(async () => {
      vi.advanceTimersByTime(SUBMISSION_POLL_FAST_MS);
    });

    await waitFor(() => {
      expect(result.current.query.data?.status).toBe('completed');
    });

    expect(apiRequestSpy).toHaveBeenCalledTimes(2);

    // Advance past slow and stop intervals
    await act(async () => {
      vi.advanceTimersByTime(SUBMISSION_POLL_STOP_AFTER_MS);
    });

    // Timers were cleared upon entering terminal status
    expect(result.current.showSlowHint).toBe(false);
    expect(result.current.pollingStopped).toBe(false);
    expect(apiRequestSpy).toHaveBeenCalledTimes(2);
  });

  it('useSubmission — 404 submission not found: exposes error without retrying', async () => {
    const error404 = new ApiError(404, 'Submission not found', 'api');
    apiRequestSpy.mockRejectedValue(error404);

    const { result } = renderHook(() => useSubmission(mockTicketId, 1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.query.isError).toBe(true);
    });

    expect(result.current.query.error?.status).toBe(404);
    // Never retried on 404
    expect(apiRequestSpy).toHaveBeenCalledTimes(1);
    expect(result.current.showSlowHint).toBe(false);
    expect(result.current.pollingStopped).toBe(false);
  });

  it('critical negative test: exact queryKey is used and broad ["ticket"] is never invalidated or queried (Doc 11 §11.7 & §11.9)', async () => {
    apiRequestSpy.mockResolvedValueOnce({
      statusCode: 200,
      message: 'Submission',
      data: { submission: mockCompletedSubmission },
    });

    const { result } = renderHook(() => useSubmission(mockTicketId, 1), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.query.isSuccess).toBe(true);
    });

    // Cached under exact query key: ['submission', id, attempt, false]
    expect(
      queryClient.getQueryData(['submission', mockTicketId, 1, false])
    ).toEqual(mockCompletedSubmission);

    // Bare ['ticket'] has no data
    expect(queryClient.getQueryData(['ticket'])).toBeUndefined();
  });
});
