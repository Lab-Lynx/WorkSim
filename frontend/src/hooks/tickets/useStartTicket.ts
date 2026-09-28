import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { Ticket, TicketWithSubmissions } from '@/types';

export type { Ticket };

export type UseStartTicketOptions = Omit<
  UseMutationOptions<Ticket, ApiError, void>,
  'mutationFn'
>;

export function useStartTicket(
  ticketId: string,
  options?: UseStartTicketOptions
): UseMutationResult<Ticket, ApiError, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<Ticket> => {
      // EP-26 POST /tickets/:ticketId/start (no body)
      const response = await apiRequest<{ ticket: Ticket }>(
        'POST',
        `/tickets/${ticketId}/start`
      );
      return response.data.ticket;
    },
    retry: false,
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Replace ticket inside queryKeys.ticket(ticketId) entry and keep its submissions
      queryClient.setQueryData<TicketWithSubmissions>(
        queryKeys.ticket(ticketId),
        (old) => {
          if (!old) {
            return {
              ticket: data,
              submissions: [],
            };
          }
          return {
            ...old,
            ticket: data,
          };
        }
      );

      // Invalidate currentTicket
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
