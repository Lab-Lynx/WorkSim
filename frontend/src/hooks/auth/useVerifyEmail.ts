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

export interface VerifyEmailInput {
  token: string;
}

export interface VerifyEmailResult {
  emailVerifiedAt: string;
}

export type UseVerifyEmailOptions = Omit<
  UseMutationOptions<VerifyEmailResult, ApiError, VerifyEmailInput>,
  'mutationFn'
>;

export function useVerifyEmail(
  options?: UseVerifyEmailOptions
): UseMutationResult<VerifyEmailResult, ApiError, VerifyEmailInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: VerifyEmailInput): Promise<VerifyEmailResult> => {
      const response = await apiRequest<VerifyEmailResult>('POST', '/auth/verify-email', {
        body: { token: input.token },
      });
      return response.data;
    },
    retry: false,
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      const existingUser = queryClient.getQueryData<User | null>(queryKeys.me);
      if (existingUser) {
        const updatedUser: User = {
          ...existingUser,
          emailVerifiedAt: data.emailVerifiedAt,
        };
        queryClient.setQueryData(queryKeys.me, updatedUser);
        useAuthStore.getState().setUser(updatedUser);
      }
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
