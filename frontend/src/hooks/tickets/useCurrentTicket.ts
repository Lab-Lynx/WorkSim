import {
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { type ApiError, shouldRetryQuery } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { Ticket } from '@/types';

export type { Ticket };

export type UseCurrentTicketOptions = Omit<
  UseQueryOptions<Ticket | null, ApiError, Ticket | null>,
  'queryKey' | 'queryFn'
>;

export function useCurrentTicket(
  options?: UseCurrentTicketOptions
): UseQueryResult<Ticket | null, ApiError> {
  return useQuery({
    queryKey: queryKeys.currentTicket,
    queryFn: async (): Promise<Ticket | null> => {
      // EP-24 GET /tickets/current
      const response = await apiRequest<{ ticket: Ticket | null }>(
        'GET',
        '/tickets/current'
      );
      return response.data.ticket;
    },
    refetchOnWindowFocus: true,
    retry: shouldRetryQuery,
    ...options,
  });
}
