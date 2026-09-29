import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import { createRepoSchema, type CreateRepoInput } from '@/schemas/github.schemas';
import type { Repo, StarterTemplate } from '@/types';

export type { CreateRepoInput, Repo };

export type UseCreateRepoOptions = Omit<
  UseMutationOptions<Repo, ApiError, CreateRepoInput>,
  'mutationFn'
>;

export function useCreateRepo(
  options?: UseCreateRepoOptions
): UseMutationResult<Repo, ApiError, CreateRepoInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRepoInput): Promise<Repo> => {
      // Validate schema-conformance before sending
      const parsed = createRepoSchema.safeParse(input);
      if (!parsed.success) {
        throw new ApiError(
          400,
          parsed.error.issues[0]?.message || 'Invalid repository creation input',
          'api'
        );
      }

      // EP-22 POST /github/repo (long timeout applied inside apiRequest)
      const body: { starterTemplate: StarterTemplate; repoName?: string } = {
        starterTemplate: parsed.data.starterTemplate,
      };

      // Omit repoName when empty or whitespace so the server default applies (A-24)
      if (parsed.data.repoName && parsed.data.repoName.trim() !== '') {
        body.repoName = parsed.data.repoName.trim();
      }

      const response = await apiRequest<{ repo: Repo }>('POST', '/github/repo', {
        body,
      });

      return response.data.repo;
    },
    retry: false,
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.githubConnection });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      const isTimeout =
        error.kind === 'timeout' ||
        error.status === 408 ||
        error.status === 504 ||
        error.message?.toLowerCase().includes('timeout');

      // Status 403, 409, or timeout invalidates githubConnection
      if (error.status === 403 || error.status === 409 || isTimeout) {
        queryClient.invalidateQueries({ queryKey: queryKeys.githubConnection });
      }

      options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}
