import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { apiRequest, resetSessionExpiredGuard } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/store/auth.store';
import type { User } from '@/types';
import type { RegisterInput } from '@/schemas/auth.schemas';

export type UseRegisterOptions = Omit<
  UseMutationOptions<User, ApiError, RegisterInput>,
  'mutationFn'
>;

export function useRegister(
  options?: UseRegisterOptions
): UseMutationResult<User, ApiError, RegisterInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RegisterInput): Promise<User> => {
      const response = await apiRequest<{ user: User }>('POST', '/auth/register', {
        body: {
          name: input.name,
          email: input.email,
          password: input.password,
        },
      });
      return response.data.user;
    },
    retry: false,
    ...options,
    onSuccess: (user, variables, onMutateResult, context) => {
      queryClient.setQueryData(queryKeys.me, user);
      useAuthStore.getState().setUser(user);
      resetSessionExpiredGuard();
      options?.onSuccess?.(user, variables, onMutateResult, context);
    },
  });
}
