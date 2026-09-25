import {
  API_BASE_PATH,
  REQUEST_TIMEOUT_DEFAULT_MS,
  REQUEST_TIMEOUT_LONG_MS,
} from '@/config/app.config';
import type { ApiEnvelope, ApiResult } from '@/types';

export type ApiErrorKind = 'api' | 'network' | 'timeout' | 'unexpected_response';

export class ApiError extends Error {
  status: number;
  kind: ApiErrorKind;

  constructor(status: number, message: string, kind: ApiErrorKind) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.kind = kind;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
  signal?: AbortSignal;
  skipAuthRefresh?: boolean;
}

export interface ApiClientConfig {
  baseUrl: string;
  onSessionExpired: () => void;
}

let clientConfig: ApiClientConfig | null = null;
let sessionExpiredGuard = false;
let refreshInFlight: Promise<void> | null = null;

const NO_REFRESH_PATHS = new Set([
  '/auth/register',
  '/auth/login',
  '/auth/refresh',
  '/auth/verify-email',
  '/auth/resend-verification',
  '/auth/forgot-password',
  '/auth/reset-password',
]);

export function configureApiClient(config: ApiClientConfig | null): void {
  clientConfig = config;
}

export function resetSessionExpiredGuard(): void {
  sessionExpiredGuard = false;
}

export function isSessionExpiredGuardActive(): boolean {
  return sessionExpiredGuard;
}

function handleSessionExpired(): void {
  if (sessionExpiredGuard) {
    return;
  }
  sessionExpiredGuard = true;
  if (clientConfig?.onSessionExpired) {
    clientConfig.onSessionExpired();
  }
}

function isLongTimeoutPath(method: HttpMethod, cleanPath: string): boolean {
  if (method !== 'POST') {
    return false;
  }
  if (cleanPath === '/github/repo' || cleanPath === '/tickets') {
    return true;
  }
  if (/^\/tickets\/[^/]+\/abandon$/.test(cleanPath)) {
    return true;
  }
  if (/^\/tickets\/[^/]+\/mentor\/messages$/.test(cleanPath)) {
    return true;
  }
  if (/^\/tickets\/[^/]+\/submissions$/.test(cleanPath)) {
    return true;
  }
  return false;
}

function buildRequestUrl(baseUrl: string, path: string, query?: RequestOptions['query']): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  let url =
    normalizedBase.endsWith(API_BASE_PATH) || normalizedBase.endsWith('/api/v1')
      ? `${normalizedBase}${normalizedPath}`
      : `${normalizedBase}${API_BASE_PATH}${normalizedPath}`;

  if (query) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) {
      url += (url.includes('?') ? '&' : '?') + qs;
    }
  }

  return url;
}

export async function refreshSessionOnce(): Promise<void> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      await apiRequest<unknown>('POST', '/auth/refresh', {
        skipAuthRefresh: true,
      });
      resetSessionExpiredGuard();
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function apiRequest<T>(
  method: HttpMethod,
  path: string,
  options?: RequestOptions
): Promise<ApiResult<T>> {
  if (!clientConfig) {
    throw new Error('API client is not configured');
  }

  const cleanPath = path.split('?')[0];

  const timeoutMs =
    options?.timeoutMs !== undefined
      ? options.timeoutMs
      : isLongTimeoutPath(method, cleanPath)
        ? REQUEST_TIMEOUT_LONG_MS
        : REQUEST_TIMEOUT_DEFAULT_MS;

  const url = buildRequestUrl(clientConfig.baseUrl, path, options?.query);

  const headers: Record<string, string> = {};
  let body: BodyInit | undefined = undefined;

  if (options?.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  let didTimeout = false;
  const controller = new AbortController();

  const onCallerAbort = () => {
    controller.abort(options?.signal?.reason);
  };

  if (options?.signal) {
    if (options.signal.aborted) {
      throw options.signal.reason ?? new DOMException('The operation was aborted', 'AbortError');
    }
    options.signal.addEventListener('abort', onCallerAbort, { once: true });
  }

  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort(new DOMException('Request timed out', 'TimeoutError'));
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      credentials: 'include',
      body,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    if (options?.signal?.aborted) {
      throw options.signal.reason ?? err;
    }
    if (didTimeout) {
      throw new ApiError(0, 'Request timed out', 'timeout');
    }
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.", 'network');
  } finally {
    clearTimeout(timeoutId);
    if (options?.signal) {
      options.signal.removeEventListener('abort', onCallerAbort);
    }
  }

  let text: string;
  try {
    text = await response.text();
  } catch {
    throw new ApiError(response.status, 'Failed to read response body', 'unexpected_response');
  }

  if (!text || text.trim() === '') {
    throw new ApiError(response.status, 'Response body was empty', 'unexpected_response');
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ApiError(response.status, 'Response is not valid JSON', 'unexpected_response');
  }

  if (
    typeof json !== 'object' ||
    json === null ||
    typeof (json as Record<string, unknown>).statusCode !== 'number' ||
    typeof (json as Record<string, unknown>).success !== 'boolean' ||
    typeof (json as Record<string, unknown>).message !== 'string'
  ) {
    throw new ApiError(response.status, 'Invalid response envelope', 'unexpected_response');
  }

  const envelope = json as ApiEnvelope<T>;
  const status = envelope.statusCode || response.status;

  if (status === 401) {
    if (NO_REFRESH_PATHS.has(cleanPath) || options?.skipAuthRefresh) {
      if (cleanPath === '/auth/refresh') {
        handleSessionExpired();
      }
      throw new ApiError(status, envelope.message, 'api');
    }

    try {
      await refreshSessionOnce();
    } catch (refreshErr) {
      if (refreshErr instanceof ApiError && refreshErr.status === 401) {
        handleSessionExpired();
        throw new ApiError(status, envelope.message, 'api');
      }
      throw refreshErr;
    }

    try {
      return await apiRequest<T>(method, path, {
        ...options,
        skipAuthRefresh: true,
      });
    } catch (replayErr) {
      if (replayErr instanceof ApiError && replayErr.status === 401) {
        handleSessionExpired();
      }
      throw replayErr;
    }
  }

  if (!response.ok || !envelope.success || status < 200 || status >= 300) {
    throw new ApiError(status, envelope.message, 'api');
  }

  return {
    data: envelope.data,
    message: envelope.message,
    statusCode: status,
  };
}
