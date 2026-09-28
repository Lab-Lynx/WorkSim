import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';

export type UseDisconnectGitHubOptions = Omit<
  UseMutationOptions<void, ApiError, void>,
  'mutationFn'
>;

export function useDisconnectGitHub(
  options?: UseDisconnectGitHubOptions
): UseMutationResult<void, ApiError, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      // EP-21 DELETE /github/connection
      // Rethrows 404 "GitHub is not connected" so the caller treats it as already done
      await apiRequest<null>('DELETE', '/github/connection');
    },
    retry: false,
    ...options,
    onSettled: (data, error, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.githubConnection });
      options?.onSettled?.(data, error, variables, onMutateResult, context);
    },
  });
}
