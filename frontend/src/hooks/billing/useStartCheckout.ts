import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';

export interface StartCheckoutResponse {
  checkoutUrl: string;
}

export type UseStartCheckoutOptions = Omit<
  UseMutationOptions<StartCheckoutResponse, ApiError, void>,
  'mutationFn'
>;

function isAbsoluteHttpsUrl(urlString: unknown): urlString is string {
  if (typeof urlString !== 'string' || !urlString.trim()) {
    return false;
  }
  try {
    const parsed = new URL(urlString);
    return (
      parsed.protocol === 'https:' ||
      (parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'))
    );
  } catch {
    return false;
  }
}

export function useStartCheckout(
  options?: UseStartCheckoutOptions
): UseMutationResult<StartCheckoutResponse, ApiError, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<StartCheckoutResponse> => {
      // EP-13 POST /subscriptions/checkout with no body (FR-17)
      const response = await apiRequest<StartCheckoutResponse>(
        'POST',
        '/subscriptions/checkout'
      );

      const checkoutUrl = response.data?.checkoutUrl;

      // Validate checkoutUrl is an absolute https: URL (A-67)
      if (!isAbsoluteHttpsUrl(checkoutUrl)) {
        throw new ApiError(
          response.statusCode || 200,
          'Invalid checkout URL received from server',
          'unexpected_response'
        );
      }

      return { checkoutUrl };
    },
    retry: false,
    ...options,
    onError: (error, variables, onMutateResult, context) => {
      const isTimeout =
        error.kind === 'timeout' ||
        error.status === 408 ||
        error.status === 504 ||
        error.message?.toLowerCase().includes('timeout');

      // Status 409 or a timeout invalidates subscription and payments cache
      if (error.status === 409 || isTimeout) {
        queryClient.invalidateQueries({ queryKey: queryKeys.subscription });
        queryClient.invalidateQueries({ queryKey: queryKeys.payments });
      }

      options?.onError?.(error, variables, onMutateResult, context);
    },
  });
}
