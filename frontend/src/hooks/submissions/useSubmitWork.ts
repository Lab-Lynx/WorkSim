import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { Submission } from '@/types';

export type { Submission };

export type UseSubmitWorkOptions = Omit<
  UseMutationOptions<Submission, ApiError, void>,
  'mutationFn'
>;

export function useSubmitWork(
  ticketId: string,
  options?: UseSubmitWorkOptions
): UseMutationResult<Submission, ApiError, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<Submission> => {
      // EP-30 POST /tickets/:ticketId/submissions, no body (long timeout applied inside apiRequest)
      const response = await apiRequest<{ submission: Submission }>(
        'POST',
        `/tickets/${ticketId}/submissions`
      );
      return response.data.submission;
    },
    retry: false,
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Seed queryKeys.submission(ticketId, submission.attempt, false) with returned submission
      queryClient.setQueryData(
        queryKeys.submission(ticketId, data.attempt, false),
        data
      );

      // Invalidate queryKeys.ticket(ticketId) and queryKeys.currentTicket
      queryClient.invalidateQueries({
        queryKey: queryKeys.ticket(ticketId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.currentTicket,
      });

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      const isTimeout =
        error.kind === 'timeout' ||
        error.status === 408 ||
        error.status === 504 ||
        error.message?.toLowerCase().includes('timeout');

      // Status 409 or timeout invalidates ticket, currentTicket, and both non-diff submission keys
      if (error.status === 409 || isTimeout) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.ticket(ticketId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.currentTicket,
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.submission(ticketId, 1, false),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.submission(ticketId, 2, false),
        });
      }

      options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}
