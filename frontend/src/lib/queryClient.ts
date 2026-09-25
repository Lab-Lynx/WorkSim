import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import axios from 'axios';
import { queryKeys } from '@/lib/query-keys';

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) {
    return false;
  }

  // Aborted or canceled requests must never be retried
  if (axios.isCancel(error)) {
    return false;
  }
  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;
    if (errObj.name === 'AbortError' || errObj.name === 'CanceledError') {
      return false;
    }
    if (errObj.code === 'ERR_CANCELED') {
      return false;
    }
    if (errObj.kind === 'abort') {
      return false;
    }
  }

  // HTTP status checks
  const status = getErrorStatus(error);
  if (status !== undefined) {
    if (status >= 400 && status < 500) {
      return false;
    }
    if (status >= 500) {
      return true;
    }
  }

  // Error kind checks (ApiError kind)
  if (typeof error === 'object' && error !== null && 'kind' in error) {
    const kind = (error as { kind: unknown }).kind;
    if (kind === 'network' || kind === 'timeout') {
      return true;
    }
  }

  // Axios network and timeout error checks
  if (axios.isAxiosError(error)) {
    if (error.code === 'ERR_NETWORK' || !error.response) {
      return true;
    }
    if (error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('timeout')) {
      return true;
    }
  }

  if (error instanceof TypeError && error.message.toLowerCase().includes('fetch')) {
    return true;
  }

  return false;
}

export function handleGlobalApiError(error: unknown, qc: QueryClient): void {
  const status = getErrorStatus(error);
  if (status === 402) {
    qc.invalidateQueries({ queryKey: queryKeys.subscription });
  } else if (status === 403) {
    qc.invalidateQueries({ queryKey: queryKeys.githubConnection });
  }
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;
    if (typeof errObj.status === 'number') {
      return errObj.status;
    }
    if (typeof errObj.statusCode === 'number') {
      return errObj.statusCode;
    }
    if (typeof errObj.response === 'object' && errObj.response !== null) {
      const resp = errObj.response as Record<string, unknown>;
      if (typeof resp.status === 'number') {
        return resp.status;
      }
    }
  }
  return undefined;
}

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => handleGlobalApiError(error, queryClient),
  }),
  mutationCache: new MutationCache({
    onError: (error) => handleGlobalApiError(error, queryClient),
  }),
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
      refetchOnWindowFocus: true,
      staleTime: 1000 * 60 * 5,
    },
    mutations: {
      retry: false,
    },
  },
});

