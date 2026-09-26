import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/store/auth.store';
import type { User } from '@/types';
import type { UpdateProfileInput } from '@/schemas/auth.schemas';

export type UseUpdateProfileOptions = Omit<
  UseMutationOptions<User, ApiError, UpdateProfileInput>,
  'mutationFn'
>;

export function useUpdateProfile(
  options?: UseUpdateProfileOptions
): UseMutationResult<User, ApiError, UpdateProfileInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProfileInput): Promise<User> => {
      const response = await apiRequest<{ user: User }>('PATCH', '/users/me', {
        body: { name: input.name },
      });
      return response.data.user;
    },
    retry: false,
    ...options,
    onSuccess: (user, variables, onMutateResult, context) => {
      queryClient.setQueryData(queryKeys.me, user);
      useAuthStore.getState().setUser(user);
      options?.onSuccess?.(user, variables, onMutateResult, context);
    },
  });
}
