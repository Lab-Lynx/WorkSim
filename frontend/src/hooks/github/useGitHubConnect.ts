import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';

export type UseGitHubConnectOptions = Omit<
  UseMutationOptions<string, ApiError, void>,
  'mutationFn'
>;

function isAbsoluteHttpsUrl(urlString: unknown): urlString is string {
  if (typeof urlString !== 'string' || !urlString.trim()) {
    return false;
  }
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function useGitHubConnect(
  options?: UseGitHubConnectOptions
): UseMutationResult<string, ApiError, void> {
  return useMutation({
    mutationFn: async (): Promise<string> => {
      // EP-18 GET /github/connect
      const response = await apiRequest<{ authorizeUrl: string }>(
        'GET',
        '/github/connect'
      );

      const authorizeUrl = response.data?.authorizeUrl;

      // Validate that the URL is an absolute https: URL (A-67)
      if (!isAbsoluteHttpsUrl(authorizeUrl)) {
        throw new ApiError(
          response.statusCode || 200,
          'Invalid authorize URL received from server',
          'unexpected_response'
        );
      }

      return authorizeUrl;
    },
    retry: false,
    ...options,
  });
}
