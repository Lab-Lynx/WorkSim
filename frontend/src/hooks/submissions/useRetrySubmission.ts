import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { Submission, SubmissionAttempt } from '@/types';

export type { Submission, SubmissionAttempt };

export type UseRetrySubmissionOptions = Omit<
  UseMutationOptions<Submission, ApiError, void>,
  'mutationFn'
>;

export function useRetrySubmission(
  ticketId: string,
  attempt: SubmissionAttempt,
  options?: UseRetrySubmissionOptions
): UseMutationResult<Submission, ApiError, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<Submission> => {
      // EP-32 POST /tickets/:ticketId/submissions/:attempt/retry (no body)
      const response = await apiRequest<{ submission: Submission }>(
        'POST',
        `/tickets/${ticketId}/submissions/${attempt}/retry`
      );
      return response.data.submission;
    },
    retry: false,
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Seed queryKeys.submission(ticketId, attempt, false) with the returned submission
      queryClient.setQueryData(
        queryKeys.submission(ticketId, attempt, false),
        data
      );

      // Invalidate queryKeys.ticket(ticketId)
      queryClient.invalidateQueries({
        queryKey: queryKeys.ticket(ticketId),
      });

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      const isTimeout =
        error.kind === 'timeout' ||
        error.status === 408 ||
        error.status === 504 ||
        error.message?.toLowerCase().includes('timeout');

      // Status 409 or timeout invalidates both queryKeys.submission(ticketId, attempt, false) and queryKeys.ticket(ticketId)
      if (error.status === 409 || isTimeout) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.submission(ticketId, attempt, false),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.ticket(ticketId),
        });
      }

      options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}
