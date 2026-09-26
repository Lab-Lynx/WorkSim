import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/errors';

export interface ResetPasswordMutationInput {
  token: string;
  newPassword: string;
}

export type UseResetPasswordOptions = Omit<
  UseMutationOptions<void, ApiError, ResetPasswordMutationInput>,
  'mutationFn'
>;

export function useResetPassword(
  options?: UseResetPasswordOptions
): UseMutationResult<void, ApiError, ResetPasswordMutationInput> {
  return useMutation({
    mutationFn: async (input: ResetPasswordMutationInput): Promise<void> => {
      await apiRequest<null>('POST', '/auth/reset-password', {
        body: {
          token: input.token,
          newPassword: input.newPassword,
        },
      });
    },
    retry: false,
    ...options,
  });
}
