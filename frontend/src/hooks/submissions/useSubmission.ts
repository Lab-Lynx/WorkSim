import { useState, useEffect, useCallback } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { type ApiError, shouldRetryQuery } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import {
  SUBMISSION_POLL_FAST_MS,
  SUBMISSION_POLL_SLOW_MS,
  SUBMISSION_POLL_SLOW_AFTER_MS,
  SUBMISSION_POLL_STOP_AFTER_MS,
} from '@/config/app.config';
import type { Submission, SubmissionAttempt } from '@/types';

export interface UseSubmissionOptions {
  includeDiff?: boolean;
  enabled?: boolean;
}

export interface UseSubmissionResult {
  query: UseQueryResult<Submission, ApiError>;
  showSlowHint: boolean;
  pollingStopped: boolean;
  restartPolling: () => void;
}

export function useSubmission(
  ticketId: string | undefined,
  attempt: SubmissionAttempt,
  options?: UseSubmissionOptions
): UseSubmissionResult {
  const includeDiff = Boolean(options?.includeDiff);
  const enabled = Boolean(ticketId) && (options?.enabled ?? true);

  const [showSlowHint, setShowSlowHint] = useState(false);
  const [pollingStopped, setPollingStopped] = useState(false);
  const [pollSession, setPollSession] = useState(0);

  // Adjust state during render when ticketId or attempt changes (per React recommendations)
  const [prevTicketId, setPrevTicketId] = useState(ticketId);
  const [prevAttempt, setPrevAttempt] = useState(attempt);

  if (ticketId !== prevTicketId || attempt !== prevAttempt) {
    setPrevTicketId(ticketId);
    setPrevAttempt(attempt);
    setShowSlowHint(false);
    setPollingStopped(false);
    setPollSession((s) => s + 1);
  }

  const query = useQuery<Submission, ApiError>({
    queryKey: queryKeys.submission(ticketId ?? '', attempt, includeDiff),
    queryFn: async (): Promise<Submission> => {
      // EP-31 GET /tickets/:ticketId/submissions/:attempt?includeDiff=<boolean>
      const response = await apiRequest<{ submission: Submission }>(
        'GET',
        `/tickets/${ticketId}/submissions/${attempt}`,
        includeDiff ? { query: { includeDiff: true } } : undefined
      );
      return response.data.submission;
    },
    enabled,
    staleTime: includeDiff ? Infinity : undefined,
    refetchOnWindowFocus: includeDiff ? false : true,
    refetchIntervalInBackground: false,
    retry: shouldRetryQuery,
    refetchInterval: (q) => {
      if (includeDiff || !q.state.data || pollingStopped) {
        return false;
      }
      const status = q.state.data.status;
      if (status === 'completed' || status === 'failed') {
        return false;
      }
      return showSlowHint ? SUBMISSION_POLL_SLOW_MS : SUBMISSION_POLL_FAST_MS;
    },
  });

  const isProcessing =
    !includeDiff &&
    (query.data?.status === 'awaiting_ci' || query.data?.status === 'evaluating');

  useEffect(() => {
    if (!isProcessing || pollingStopped) {
      return;
    }

    const slowTimer = setTimeout(() => {
      setShowSlowHint(true);
    }, SUBMISSION_POLL_SLOW_AFTER_MS);

    const stopTimer = setTimeout(() => {
      setPollingStopped(true);
    }, SUBMISSION_POLL_STOP_AFTER_MS);

    return () => {
      clearTimeout(slowTimer);
      clearTimeout(stopTimer);
    };
  }, [isProcessing, pollSession, pollingStopped]);

  const restartPolling = useCallback(() => {
    setPollingStopped(false);
    setShowSlowHint(false);
    setPollSession((s) => s + 1);
    query.refetch();
  }, [query]);

  return {
    query,
    showSlowHint: isProcessing ? showSlowHint : false,
    pollingStopped: isProcessing ? pollingStopped : false,
    restartPolling,
  };
}
