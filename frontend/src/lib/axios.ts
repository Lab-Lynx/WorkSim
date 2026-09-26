import axios from 'axios';
import { env } from '@/config/env';
import { useAuthStore } from '@/store/auth.store';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/query-keys';
import { buildLoginRedirect } from '@/lib/navigation';
import router from '@/routes';
import type { ApiResponse } from '@/types';

const api = axios.create({
  baseURL: env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
  // Send/receive the httpOnly auth cookies on every request. Required for
  // cookie-based auth to work at all — without this, the browser won't
  // attach them cross-origin (frontend and backend run on different
  // origins even in dev: 5173 vs 3000).
  withCredentials: true,
});

let refreshPromise: Promise<void> | null = null;
let sessionExpiredGuard = false;
let onSessionExpiredCallback: (() => void) | null = null;

export function resetSessionExpiredGuard(): void {
  sessionExpiredGuard = false;
}

export function isSessionExpiredGuardActive(): boolean {
  return sessionExpiredGuard;
}

export function configureApiClient(config: {
  baseUrl?: string;
  onSessionExpired?: () => void;
}): void {
  if (config.baseUrl) {
    api.defaults.baseURL = config.baseUrl;
  }
  if (config.onSessionExpired) {
    onSessionExpiredCallback = config.onSessionExpired;
  }
}

export function getSessionExpiredCallback(): (() => void) | null {
  return onSessionExpiredCallback;
}

export function defaultOnSessionExpired(): void {
  const location = router.state?.location;
  const currentPath = location
    ? location.pathname + location.search + location.hash
    : window.location.pathname + window.location.search + window.location.hash;

  router.navigate(buildLoginRedirect(currentPath), {
    replace: true,
    state: { notice: 'session_expired' },
  });

  queryClient.clear();
  useAuthStore.getState().clearAuth();
}

function handleSessionExpired(): void {
  const hasCachedUser = !!queryClient.getQueryData(queryKeys.me) || !!useAuthStore.getState().user;

  if (!hasCachedUser) {
    return;
  }

  if (sessionExpiredGuard) {
    return;
  }
  sessionExpiredGuard = true;

  if (onSessionExpiredCallback) {
    onSessionExpiredCallback();
  } else {
    defaultOnSessionExpired();
  }
}

// Response interceptor:
//  1. Unwraps the backend's { statusCode, success, message, data } envelope.
//  2. On a 401, tries POST /auth/refresh once (relies on the httpOnly
//     refresh cookie — nothing to pass explicitly), then retries the
//     original request. If refresh also fails, the session is genuinely
//     over: clear local state, clear cache, and send the user to /login with
//     a session_expired notice.
api.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse<unknown>;
    if (body && typeof body === 'object' && 'data' in body) {
      response.data = body.data;
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config as
      (typeof error.config & { _retry?: boolean }) | undefined;
    const isRefreshPath = originalRequest?.url?.includes('/auth/refresh');
    const isAuthRoute =
      originalRequest?.url?.includes('/auth/register') ||
      originalRequest?.url?.includes('/auth/login') ||
      isRefreshPath ||
      originalRequest?.url?.includes('/auth/verify-email') ||
      originalRequest?.url?.includes('/auth/resend-verification') ||
      originalRequest?.url?.includes('/auth/forgot-password') ||
      originalRequest?.url?.includes('/auth/reset-password');

    if (error.response?.status !== 401 || !originalRequest) {
      return Promise.reject(error);
    }

    // A 401 on an auth route itself (bad login, refresh already dead)
    // means "actually not authenticated" — don't try to refresh.
    if (isAuthRoute) {
      if (isRefreshPath) {
        handleSessionExpired();
      } else {
        useAuthStore.getState().clearAuth();
      }
      return Promise.reject(error);
    }

    if (originalRequest._retry) {
      // Already retried once after a refresh — replay returned 401: session is over.
      handleSessionExpired();
      return Promise.reject(error);
    }
    originalRequest._retry = true;

    try {
      // Multiple requests can 401 at the same time (e.g. a page firing
      // several queries at once) — share one in-flight refresh instead of
      // firing /auth/refresh N times.
      refreshPromise ??= api
        .post('/auth/refresh')
        .then(() => {
          resetSessionExpiredGuard();
        })
        .finally(() => {
          refreshPromise = null;
        });
      await refreshPromise;
      return api(originalRequest);
    } catch (refreshError) {
      if (axios.isAxiosError(refreshError) && refreshError.response?.status === 401) {
        handleSessionExpired();
      }
      return Promise.reject(refreshError);
    }
  }
);

export default api;
