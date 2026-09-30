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
import type { LoginInput } from '@/schemas/auth.schemas';

export type UseLoginOptions = Omit<
  UseMutationOptions<User, ApiError, LoginInput>,
  'mutationFn'
>;

export function useLogin(
  options?: UseLoginOptions
): UseMutationResult<User, ApiError, LoginInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LoginInput): Promise<User> => {
      const response = await apiRequest<{ user: User }>('POST', '/auth/login', {
        body: {
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
