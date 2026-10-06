import {
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { type ApiError, shouldRetryQuery } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { SubmissionListItem } from '@/types';

export type UseSubmissionsOptions = Omit<
  UseQueryOptions<SubmissionListItem[], ApiError, SubmissionListItem[]>,
  'queryKey' | 'queryFn'
>;

/** EP-35 GET /submissions */
export function useSubmissions(
  options?: UseSubmissionsOptions,
): UseQueryResult<SubmissionListItem[], ApiError> {
  return useQuery({
    queryKey: queryKeys.submissions,
    queryFn: async (): Promise<SubmissionListItem[]> => {
      const response = await apiRequest<{ items: SubmissionListItem[] }>('GET', '/submissions');
      return response.data.items;
    },
    retry: shouldRetryQuery,
    ...options,
  });
}
