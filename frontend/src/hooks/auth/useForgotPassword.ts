import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/errors';
import type { ForgotPasswordInput } from '@/schemas/auth.schemas';

export type UseForgotPasswordOptions = Omit<
  UseMutationOptions<{ message: string }, ApiError, ForgotPasswordInput>,
  'mutationFn'
>;

export function useForgotPassword(
  options?: UseForgotPasswordOptions
): UseMutationResult<{ message: string }, ApiError, ForgotPasswordInput> {
  return useMutation({
    mutationFn: async (input: ForgotPasswordInput): Promise<{ message: string }> => {
      const response = await apiRequest<null>('POST', '/auth/forgot-password', {
        body: { email: input.email },
      });
      return { message: response.message };
    },
    retry: false,
    ...options,
  });
}
