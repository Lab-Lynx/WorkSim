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

export type UseAssignTicketOptions = Omit<
  UseMutationOptions<Ticket, ApiError, void>,
  'mutationFn'
>;

export function useAssignTicket(
  options?: UseAssignTicketOptions
): UseMutationResult<Ticket, ApiError, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<Ticket> => {
      // EP-23 POST /tickets with no body (no template choice, Q-09; long timeout applied inside apiRequest)
      const response = await apiRequest<{ ticket: Ticket }>('POST', '/tickets');
      return response.data.ticket;
    },
    retry: false,
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Seed queryKeys.ticket(id) with { ticket, submissions: [] }
      queryClient.setQueryData<TicketWithSubmissions>(
        queryKeys.ticket(data.id),
        {
          ticket: data,
          submissions: [],
        }
      );

      // Set queryKeys.currentTicket
      queryClient.setQueryData<Ticket>(queryKeys.currentTicket, data);

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      const isTimeout =
        error.kind === 'timeout' ||
        error.status === 408 ||
        error.status === 504 ||
        error.message?.toLowerCase().includes('timeout');

      // Status 409 or timeout invalidates both queryKeys.currentTicket and queryKeys.githubConnection
      if (error.status === 409 || isTimeout) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.currentTicket,
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.githubConnection,
        });
      }

      options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}
