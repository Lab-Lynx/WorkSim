import {
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { type ApiError, shouldRetryQuery } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { ProfileItem } from '@/types';

export type { ProfileItem };

export type UseExperienceProfileOptions = Omit<
  UseQueryOptions<ProfileItem[], ApiError, ProfileItem[]>,
  'queryKey' | 'queryFn'
>;

/**
 * useExperienceProfile — EP-34 `GET /profile`
 * Practice work-sample record: completed tickets only (decided by server).
 * No client-side filtering, sorting, or pagination. No public/shareable variant (FR-52).
 */
export function useExperienceProfile(
  options?: UseExperienceProfileOptions
): UseQueryResult<ProfileItem[], ApiError> {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: async (): Promise<ProfileItem[]> => {
      const response = await apiRequest<{ items: ProfileItem[] }>('GET', '/profile');
      return response.data.items;
    },
    retry: shouldRetryQuery,
    ...options,
  });
}
