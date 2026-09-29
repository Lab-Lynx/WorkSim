import {
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { type ApiError, shouldRetryQuery } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { SubscriptionStatusResponse } from '@/types';

export type { SubscriptionStatusResponse };

export type UseSubscriptionOptions = Omit<
  UseQueryOptions<SubscriptionStatusResponse, ApiError, SubscriptionStatusResponse>,
  'queryKey' | 'queryFn'
> & {
  refetchIntervalMs?: number | false;
};

export function useSubscription(
  options?: UseSubscriptionOptions
): UseQueryResult<SubscriptionStatusResponse, ApiError> {
  const { refetchIntervalMs, ...queryOptions } = options ?? {};

  return useQuery({
    queryKey: queryKeys.subscription,
    queryFn: async (): Promise<SubscriptionStatusResponse> => {
      // EP-15 GET /subscriptions/me
      const response = await apiRequest<SubscriptionStatusResponse>(
        'GET',
        '/subscriptions/me'
      );

      // hasAccess is used exactly as the server sent it (never recomputed from currentPeriodEnd)
      return response.data;
    },
    refetchOnWindowFocus: queryOptions.refetchOnWindowFocus ?? true,
    refetchInterval:
      refetchIntervalMs !== undefined
        ? refetchIntervalMs || false
        : (queryOptions.refetchInterval ?? false),
    retry: shouldRetryQuery,
    ...queryOptions,
  });
}
