import type { QueryClient } from '@tanstack/react-query';
import type { UseFormSetError, FieldValues, Path } from 'react-hook-form';
import axios from 'axios';
import { queryKeys } from '@/lib/query-keys';

export type ApiErrorKind = 'api' | 'network' | 'timeout' | 'unexpected_response';

export class ApiError extends Error {
  status: number; // HTTP or envelope status; 0 when no response arrived
  kind: ApiErrorKind;

  constructor(status: number, message: string, kind: ApiErrorKind) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.kind = kind;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export type UiErrorAction =
  | 'none'
  | 'retry'
  | 'go_billing'
  | 'reconnect_github'
  | 'refetch'
  | 'request_new_link';

export interface UiError {
  status: number;
  kind: ApiErrorKind;
  message: string;
  action: UiErrorAction;
  isNotFound: boolean;
  isTimeout: boolean;
}

export type FormErrorContext = 'register' | 'changePassword' | 'resetPassword';

export const GENERIC_NETWORK_MESSAGE =
  "Can't reach the server. Check your connection and try again.";

export const SERVER_MESSAGES = {
  currentPasswordIncorrect: 'Current password is incorrect',
  invalidResetLink: 'Invalid reset link',
} as const;

function isApiErrorLike(err: unknown): err is ApiError {
  if (err instanceof ApiError) {
    return true;
  }
  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>;
    const hasStatus = typeof obj.status === 'number';
    const hasKind =
      typeof obj.kind === 'string' &&
      ['api', 'network', 'timeout', 'unexpected_response'].includes(obj.kind);

    if (obj.name === 'ApiError' && (hasStatus || hasKind)) {
      return true;
    }
    if (hasStatus && hasKind) {
      return true;
    }
  }
  return false;
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

export function mapApiError(error: unknown): UiError {
  if (!isApiErrorLike(error)) {
    return {
      status: 0,
      kind: 'network',
      message: GENERIC_NETWORK_MESSAGE,
      action: 'retry',
      isNotFound: false,
      isTimeout: false,
    };
  }

  const status = typeof error.status === 'number' ? error.status : 0;
  const kind = (error.kind as ApiErrorKind) || 'api';
  const isTimeout = kind === 'timeout';

  if (kind !== 'api') {
    return {
      status,
      kind,
      message: GENERIC_NETWORK_MESSAGE,
      action: 'retry',
      isNotFound: false,
      isTimeout,
    };
  }

  let action: UiErrorAction;
  let isNotFound = false;

  if (status === 402) {
    action = 'go_billing';
  } else if (status === 403) {
    action = 'reconnect_github';
  } else if (status === 404) {
    action = 'none';
    isNotFound = true;
  } else if (status === 409) {
    action = 'refetch';
  } else if (status === 410) {
    action = 'request_new_link';
  } else if (status >= 500) {
    action = 'retry';
  } else {
    action = 'none';
  }

  return {
    status,
    kind: 'api',
    message: typeof error.message === 'string' ? error.message : '',
    action,
    isNotFound,
    isTimeout: false,
  };
}

export function applyServerErrorToForm<TFieldValues extends FieldValues = FieldValues>(
  error: unknown,
  form: { setError: UseFormSetError<TFieldValues> },
  context?: FormErrorContext
): UiError {
  const uiError = mapApiError(error);

  if (context === 'register' && uiError.status === 409) {
    form.setError('email' as Path<TFieldValues>, {
      type: 'server',
      message: uiError.message,
    });
    return uiError;
  }

  if (
    context === 'changePassword' &&
    uiError.status === 400 &&
    uiError.message === SERVER_MESSAGES.currentPasswordIncorrect
  ) {
    form.setError('currentPassword' as Path<TFieldValues>, {
      type: 'server',
      message: uiError.message,
    });
    return uiError;
  }

  if (
    context === 'resetPassword' &&
    uiError.status === 400 &&
    uiError.message === SERVER_MESSAGES.invalidResetLink
  ) {
    // Exception 3: not set on form, returned so page can show its invalid-link view
    return uiError;
  }

  form.setError('root', {
    type: 'server',
    message: uiError.message,
  });

  return uiError;
}

export function handleGlobalApiError(error: unknown, queryClient: QueryClient): void {
  const status = getErrorStatus(error);
  if (status === 402) {
    queryClient.invalidateQueries({ queryKey: queryKeys.subscription });
  } else if (status === 403) {
    queryClient.invalidateQueries({ queryKey: queryKeys.githubConnection });
  }
}

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
