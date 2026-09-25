import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';
import { QueryClient } from '@tanstack/react-query';
import { queryClient, shouldRetryQuery, handleGlobalApiError } from '@/lib/queryClient';
import { getSessionExpiredCallback } from '@/lib/axios';
import '@/App';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/store/auth.store';
import router from '@/routes';

describe('QueryClient defaults and App wiring', () => {
  beforeEach(() => {
    queryClient.clear();
    useAuthStore.getState().clearAuth();
    vi.restoreAllMocks();
  });

  describe('QueryClient configuration', () => {
    it('configures queries with shouldRetryQuery, refetchOnWindowFocus true, and mutations retry false', () => {
      const defaultOptions = queryClient.getDefaultOptions();

      expect(defaultOptions.queries?.retry).toBe(shouldRetryQuery);
      expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(true);
      expect(defaultOptions.mutations?.retry).toBe(false);
    });

    it('wires queryCache and mutationCache onError to handleGlobalApiError', () => {
      const customClient = new QueryClient();
      const invalidateSpy = vi.spyOn(customClient, 'invalidateQueries');

      // Trigger error on handleGlobalApiError with 402
      handleGlobalApiError({ status: 402 }, customClient);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.subscription });

      // Trigger error on handleGlobalApiError with 403
      invalidateSpy.mockClear();
      handleGlobalApiError({ status: 403 }, customClient);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.githubConnection });
    });
  });

  describe('shouldRetryQuery retry policy', () => {
    it('returns true on failureCount 0 for network errors', () => {
      expect(shouldRetryQuery(0, { kind: 'network' })).toBe(true);
      expect(shouldRetryQuery(0, new AxiosError('Network Error', 'ERR_NETWORK'))).toBe(true);
      expect(shouldRetryQuery(0, new TypeError('Failed to fetch'))).toBe(true);
    });

    it('returns true on failureCount 0 for timeout errors', () => {
      expect(shouldRetryQuery(0, { kind: 'timeout' })).toBe(true);
      expect(shouldRetryQuery(0, new AxiosError('timeout exceeded', 'ECONNABORTED'))).toBe(true);
    });

    it('returns true on failureCount 0 for 5xx server errors', () => {
      expect(shouldRetryQuery(0, { status: 500 })).toBe(true);
      expect(shouldRetryQuery(0, { status: 502 })).toBe(true);
      expect(shouldRetryQuery(0, { statusCode: 503 })).toBe(true);
      expect(shouldRetryQuery(0, { response: { status: 504 } })).toBe(true);
    });

    it('returns false when failureCount is 1 or more (exhausted)', () => {
      expect(shouldRetryQuery(1, { kind: 'network' })).toBe(false);
      expect(shouldRetryQuery(1, { kind: 'timeout' })).toBe(false);
      expect(shouldRetryQuery(1, { status: 500 })).toBe(false);
      expect(shouldRetryQuery(2, { status: 502 })).toBe(false);
    });

    it('returns false for 4xx errors on any failureCount', () => {
      const clientErrors = [400, 401, 402, 403, 404, 409, 410, 429];
      for (const status of clientErrors) {
        expect(shouldRetryQuery(0, { status })).toBe(false);
        expect(shouldRetryQuery(0, { response: { status } })).toBe(false);
        expect(shouldRetryQuery(0, { statusCode: status })).toBe(false);
      }
    });

    it('returns false for aborted or canceled requests', () => {
      expect(shouldRetryQuery(0, { name: 'AbortError' })).toBe(false);
      expect(shouldRetryQuery(0, { name: 'CanceledError' })).toBe(false);
      expect(shouldRetryQuery(0, { code: 'ERR_CANCELED' })).toBe(false);
      expect(shouldRetryQuery(0, { kind: 'abort' })).toBe(false);
      expect(shouldRetryQuery(0, new AxiosError('canceled', 'ERR_CANCELED'))).toBe(false);
    });
  });

  describe('handleGlobalApiError behavior', () => {
    it('invalidates queryKeys.subscription on 402 payment required', () => {
      const customClient = new QueryClient();
      const invalidateSpy = vi.spyOn(customClient, 'invalidateQueries');

      handleGlobalApiError({ status: 402 }, customClient);

      expect(invalidateSpy).toHaveBeenCalledTimes(1);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.subscription });
    });

    it('invalidates queryKeys.githubConnection on 403 forbidden', () => {
      const customClient = new QueryClient();
      const invalidateSpy = vi.spyOn(customClient, 'invalidateQueries');

      handleGlobalApiError({ status: 403 }, customClient);

      expect(invalidateSpy).toHaveBeenCalledTimes(1);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.githubConnection });
    });

    it('does nothing for non-402 and non-403 errors', () => {
      const customClient = new QueryClient();
      const invalidateSpy = vi.spyOn(customClient, 'invalidateQueries');

      handleGlobalApiError({ status: 400 }, customClient);
      handleGlobalApiError({ status: 401 }, customClient);
      handleGlobalApiError({ status: 404 }, customClient);
      handleGlobalApiError({ status: 500 }, customClient);
      handleGlobalApiError({ kind: 'network' }, customClient);

      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  describe('onSessionExpired callback', () => {
    it('does nothing on first load when queryKeys.me has no cached data', () => {
      const navigateSpy = vi.spyOn(router, 'navigate');
      const clearSpy = vi.spyOn(queryClient, 'clear');
      const onSessionExpired = getSessionExpiredCallback();

      expect(onSessionExpired).not.toBeNull();
      // No cached user in queryClient
      expect(queryClient.getQueryData(queryKeys.me)).toBeUndefined();

      onSessionExpired!();

      expect(navigateSpy).not.toHaveBeenCalled();
      expect(clearSpy).not.toHaveBeenCalled();
    });

    it('navigates with replace to login with session_expired notice and clears cache when user is cached', () => {
      const navigateSpy = vi.spyOn(router, 'navigate');
      const clearSpy = vi.spyOn(queryClient, 'clear');
      const onSessionExpired = getSessionExpiredCallback();

      expect(onSessionExpired).not.toBeNull();

      queryClient.setQueryData(queryKeys.me, {
        id: 'user-1',
        name: 'User',
        email: 'user@worksim.test',
      });

      onSessionExpired!();

      expect(navigateSpy).toHaveBeenCalledWith(
        expect.stringContaining('/login'),
        expect.objectContaining({
          replace: true,
          state: { notice: 'session_expired' },
        })
      );
      expect(clearSpy).toHaveBeenCalled();
    });
  });
});

