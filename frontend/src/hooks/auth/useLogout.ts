import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { ROUTES } from '@/constants';
import { useAuthStore } from '@/store/auth.store';

export type UseLogoutOptions = Omit<
  UseMutationOptions<void, ApiError, void>,
  'mutationFn'
>;

export function useLogout(
  options?: UseLogoutOptions
): UseMutationResult<void, ApiError, void> {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      try {
        await apiRequest<null>('POST', '/auth/logout');
      } catch (err: unknown) {
        const is401 =
          (err instanceof ApiError && err.status === 401) ||
          (typeof err === 'object' &&
            err !== null &&
            'status' in err &&
            (err as { status: unknown }).status === 401);

        if (is401) {
          return;
        }
        throw err;
      }
    },
    retry: false,
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      navigate(ROUTES.LOGIN, {
        replace: true,
      });
      useAuthStore.getState().clearAuth();
      queryClient.clear();
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}
