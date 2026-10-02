import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { AbandonResult } from '@/types';

export type { AbandonResult };

export type UseAbandonTicketOptions = Omit<
  UseMutationOptions<AbandonResult, ApiError, void>,
  'mutationFn'
>;

export function useAbandonTicket(
  ticketId: string,
  options?: UseAbandonTicketOptions
): UseMutationResult<AbandonResult, ApiError, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<AbandonResult> => {
      // EP-27 POST /tickets/:ticketId/abandon (no body, long timeout applied inside apiRequest)
      const response = await apiRequest<AbandonResult>(
        'POST',
        `/tickets/${ticketId}/abandon`
      );
      return response.data;
    },
    retry: false,
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Invalidate the abandoned ticket cache
      queryClient.invalidateQueries({
        queryKey: queryKeys.ticket(data.abandonedTicketId || ticketId),
      });

      // If newTicket exists, seed its ticket cache and set currentTicket
      if (data.newTicket) {
        queryClient.setQueryData(queryKeys.ticket(data.newTicket.id), {
          ticket: data.newTicket,
          submissions: [],
        });
        queryClient.setQueryData(queryKeys.currentTicket, data.newTicket);
      } else {
        // If newTicket is null, set currentTicket to null, then invalidate it
        queryClient.setQueryData(queryKeys.currentTicket, null);
        queryClient.invalidateQueries({
          queryKey: queryKeys.currentTicket,
        });
      }

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      const isTimeout =
        error.kind === 'timeout' ||
        error.status === 408 ||
        error.status === 504 ||
        error.message?.toLowerCase().includes('timeout');

      // Status 409 or timeout invalidates both queryKeys.ticket(ticketId) and queryKeys.currentTicket
      if (error.status === 409 || isTimeout) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.ticket(ticketId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.currentTicket,
        });
      }

      options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}
