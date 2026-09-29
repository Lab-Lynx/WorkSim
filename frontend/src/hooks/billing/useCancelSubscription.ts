import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';
import type { Subscription } from '@/types';

export type { Subscription };

export type UseCancelSubscriptionOptions = Omit<
  UseMutationOptions<Subscription, ApiError, void>,
  'mutationFn'
>;

export function useCancelSubscription(
  options?: UseCancelSubscriptionOptions
): UseMutationResult<Subscription, ApiError, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<Subscription> => {
      const response = await apiRequest<{ subscription: Subscription }>(
        'POST',
        '/subscriptions/cancel'
      );
      return response.data.subscription;
    },
    retry: false,
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      const isTimeout =
        error.kind === 'timeout' ||
        error.status === 408 ||
        error.status === 504 ||
        error.message?.toLowerCase().includes('timeout');

      if (error.status === 409 || isTimeout) {
        queryClient.invalidateQueries({ queryKey: queryKeys.subscription });
      }
      options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}
