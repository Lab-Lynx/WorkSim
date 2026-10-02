import {
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { type ApiError, shouldRetryQuery } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { GitHubConnectionSummary } from '@/types';

export type { GitHubConnectionSummary };

export type UseGitHubConnectionOptions = Omit<
  UseQueryOptions<GitHubConnectionSummary, ApiError, GitHubConnectionSummary>,
  'queryKey' | 'queryFn'
>;

export function useGitHubConnection(
  options?: UseGitHubConnectionOptions
): UseQueryResult<GitHubConnectionSummary, ApiError> {
  return useQuery({
    queryKey: queryKeys.githubConnection,
    queryFn: async (): Promise<GitHubConnectionSummary> => {
      // EP-20 GET /github/connection
      const response = await apiRequest<GitHubConnectionSummary>(
        'GET',
        '/github/connection'
      );

      // repo may be non-null while connected is false (A-07)
      // Never infer connected from repo; use response.data authoritative from server
      return response.data;
    },
    refetchOnWindowFocus: true,
    retry: shouldRetryQuery,
    ...options,
  });
}
