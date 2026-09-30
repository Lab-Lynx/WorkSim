import {
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { type ApiError, shouldRetryQuery } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { Submission, Ticket, TicketWithSubmissions } from '@/types';

export type { Submission, Ticket, TicketWithSubmissions };

export type UseTicketOptions = Omit<
  UseQueryOptions<TicketWithSubmissions, ApiError, TicketWithSubmissions>,
  'queryKey' | 'queryFn'
>;

export function useTicket(
  ticketId: string | undefined,
  options?: UseTicketOptions
): UseQueryResult<TicketWithSubmissions, ApiError> {
  return useQuery({
    queryKey: queryKeys.ticket(ticketId ?? ''),
    queryFn: async (): Promise<TicketWithSubmissions> => {
      // EP-25 GET /tickets/:ticketId
      const response = await apiRequest<TicketWithSubmissions>(
        'GET',
        `/tickets/${ticketId}`
      );
      return response.data;
    },
    enabled: Boolean(ticketId) && (options?.enabled ?? true),
    refetchOnWindowFocus: true,
    retry: shouldRetryQuery,
    ...options,
  });
}
