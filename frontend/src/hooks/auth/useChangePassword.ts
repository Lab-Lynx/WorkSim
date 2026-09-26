import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/errors';
import type { ChangePasswordInput } from '@/schemas/auth.schemas';

export type UseChangePasswordOptions = Omit<
  UseMutationOptions<void, ApiError, ChangePasswordInput>,
  'mutationFn'
>;

export function useChangePassword(
  options?: UseChangePasswordOptions
): UseMutationResult<void, ApiError, ChangePasswordInput> {
  return useMutation({
    mutationFn: async (input: ChangePasswordInput): Promise<void> => {
      await apiRequest<null>('POST', '/auth/change-password', {
        body: {
          currentPassword: input.currentPassword,
          newPassword: input.newPassword,
        },
      });
    },
    retry: false,
    ...options,
  });
}
