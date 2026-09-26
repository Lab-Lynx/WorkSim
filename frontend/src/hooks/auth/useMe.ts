import {
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { type ApiError, shouldRetryQuery } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import { ME_STALE_TIME_MS } from '@/config/app.config';
import type { User } from '@/types';

export type { User };

export type UseMeOptions = Omit<
  UseQueryOptions<User, ApiError, User>,
  'queryKey' | 'queryFn'
>;

export function useMe(options?: UseMeOptions): UseQueryResult<User, ApiError> {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async (): Promise<User> => {
      const response = await apiRequest<{ user: User }>('GET', '/users/me');
      return response.data.user;
    },
    staleTime: ME_STALE_TIME_MS,
    retry: shouldRetryQuery,
    refetchOnWindowFocus: false,
    ...options,
  });
}
