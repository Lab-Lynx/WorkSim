import {
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { type ApiError, shouldRetryQuery } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { Payment } from '@/types';

export type { Payment };

export type UsePaymentsOptions = Omit<
  UseQueryOptions<Payment[], ApiError, Payment[]>,
  'queryKey' | 'queryFn'
>;

export function usePayments(
  options?: UsePaymentsOptions
): UseQueryResult<Payment[], ApiError> {
  return useQuery({
    queryKey: queryKeys.payments,
    queryFn: async (): Promise<Payment[]> => {
      const response = await apiRequest<{ payments: Payment[] }>('GET', '/payments');
      return response.data.payments;
    },
    retry: shouldRetryQuery,
    ...options,
  });
}
