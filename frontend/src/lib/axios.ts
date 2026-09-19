import axios from 'axios';
import { env } from '@/config/env';
import { useAuthStore } from '@/store/auth.store';
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

// Response interceptor:
//  1. Unwraps the backend's { statusCode, success, message, data } envelope.
//  2. On a 401, tries POST /auth/refresh once (relies on the httpOnly
//     refresh cookie — nothing to pass explicitly), then retries the
//     original request. If refresh also fails, the session is genuinely
//     over: clear local state and send the user to /login.
api.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse<unknown>;
    if (body && typeof body === 'object' && 'data' in body) {
      response.data = body.data;
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    const isAuthRoute = originalRequest?.url?.includes('/auth/');

    if (error.response?.status !== 401 || !originalRequest) {
      return Promise.reject(error);
    }

    // A 401 on an auth route itself (bad login, refresh already dead)
    // means "actually not authenticated" — don't try to refresh, just
    // clear state so the UI reflects reality.
    if (isAuthRoute) {
      useAuthStore.getState().clearAuth();
      return Promise.reject(error);
    }

    if (originalRequest._retry) {
      // Already retried once after a refresh — don't loop forever.
      useAuthStore.getState().clearAuth();
      window.location.href = '/login';
      return Promise.reject(error);
    }
    originalRequest._retry = true;

    try {
      // Multiple requests can 401 at the same time (e.g. a page firing
      // several queries at once) — share one in-flight refresh instead of
      // firing /auth/refresh N times.
      refreshPromise ??= api
        .post('/auth/refresh')
        .then(() => undefined)
        .finally(() => {
          refreshPromise = null;
        });
      await refreshPromise;
      return api(originalRequest);
    } catch (refreshError) {
      useAuthStore.getState().clearAuth();
      window.location.href = '/login';
      return Promise.reject(refreshError);
    }
  }
);

export default api;
