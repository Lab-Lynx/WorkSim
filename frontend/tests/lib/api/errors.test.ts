import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import axios, { AxiosError, type AxiosResponse } from 'axios';
import {
  ApiError,
  mapApiError,
  applyServerErrorToForm,
  handleGlobalApiError,
  shouldRetryQuery,
  GENERIC_NETWORK_MESSAGE,
  SERVER_MESSAGES,
  type ApiErrorKind,
} from '@/lib/api/errors';
import { queryKeys } from '@/lib/query-keys';

describe('API errors and retry policy — frontend/src/lib/api/errors.ts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('ApiError class', () => {
    it('constructs with status, message, and kind', () => {
      const error = new ApiError(404, 'Not Found', 'api');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.name).toBe('ApiError');
      expect(error.status).toBe(404);
      expect(error.message).toBe('Not Found');
      expect(error.kind).toBe('api');
    });

    it('supports 0 status for network/timeout kinds', () => {
      const netErr = new ApiError(0, 'Network Failed', 'network');
      expect(netErr.status).toBe(0);
      expect(netErr.kind).toBe('network');

      const timeoutErr = new ApiError(0, 'Request timed out', 'timeout');
      expect(timeoutErr.status).toBe(0);
      expect(timeoutErr.kind).toBe('timeout');

      const unexpErr = new ApiError(502, 'Malformed JSON', 'unexpected_response');
      expect(unexpErr.status).toBe(502);
      expect(unexpErr.kind).toBe('unexpected_response');
    });
  });

  describe('mapApiError (doc 11 §11.2.2)', () => {
    it('mapApiError — network/timeout/unexpected response: returns generic message, retry, isNotFound: false; timeout sets isTimeout', () => {
      const kinds: ApiErrorKind[] = ['network', 'timeout', 'unexpected_response'];

      for (const kind of kinds) {
        const error = new ApiError(0, 'Internal technical detail that should be hidden', kind);
        const mapped = mapApiError(error);

        expect(mapped.message).toBe(GENERIC_NETWORK_MESSAGE);
        expect(mapped.action).toBe('retry');
        expect(mapped.isNotFound).toBe(false);
        expect(mapped.kind).toBe(kind);

        if (kind === 'timeout') {
          expect(mapped.isTimeout).toBe(true);
        } else {
          expect(mapped.isTimeout).toBe(false);
        }
      }
    });

    it('mapApiError — 400/401: action is none, isNotFound is false, preserves server message', () => {
      const err400 = new ApiError(400, 'Bad request payload', 'api');
      const mapped400 = mapApiError(err400);
      expect(mapped400.status).toBe(400);
      expect(mapped400.kind).toBe('api');
      expect(mapped400.message).toBe('Bad request payload');
      expect(mapped400.action).toBe('none');
      expect(mapped400.isNotFound).toBe(false);
      expect(mapped400.isTimeout).toBe(false);

      const err401 = new ApiError(401, 'Unauthorized credentials', 'api');
      const mapped401 = mapApiError(err401);
      expect(mapped401.status).toBe(401);
      expect(mapped401.kind).toBe('api');
      expect(mapped401.message).toBe('Unauthorized credentials');
      expect(mapped401.action).toBe('none');
      expect(mapped401.isNotFound).toBe(false);
      expect(mapped401.isTimeout).toBe(false);
    });

    it('mapApiError — 402: action is go_billing, preserves server message', () => {
      const err402 = new ApiError(402, 'Active subscription required', 'api');
      const mapped = mapApiError(err402);
      expect(mapped.status).toBe(402);
      expect(mapped.message).toBe('Active subscription required');
      expect(mapped.action).toBe('go_billing');
      expect(mapped.isNotFound).toBe(false);
      expect(mapped.isTimeout).toBe(false);
    });

    it('mapApiError — 403: action is reconnect_github, preserves server message', () => {
      const err403 = new ApiError(403, 'GitHub access token expired', 'api');
      const mapped = mapApiError(err403);
      expect(mapped.status).toBe(403);
      expect(mapped.message).toBe('GitHub access token expired');
      expect(mapped.action).toBe('reconnect_github');
      expect(mapped.isNotFound).toBe(false);
      expect(mapped.isTimeout).toBe(false);
    });

    it('mapApiError — 404: action is none, isNotFound is true, preserves server message', () => {
      const err404 = new ApiError(404, 'Ticket not found', 'api');
      const mapped = mapApiError(err404);
      expect(mapped.status).toBe(404);
      expect(mapped.message).toBe('Ticket not found');
      expect(mapped.action).toBe('none');
      expect(mapped.isNotFound).toBe(true);
      expect(mapped.isTimeout).toBe(false);
    });

    it('mapApiError — 409/410/429: maps correctly (409=refetch, 410=request_new_link, 429=none)', () => {
      const err409 = new ApiError(409, 'Conflict: state already updated', 'api');
      const mapped409 = mapApiError(err409);
      expect(mapped409.action).toBe('refetch');
      expect(mapped409.isNotFound).toBe(false);
      expect(mapped409.message).toBe('Conflict: state already updated');

      const err410 = new ApiError(410, 'Link has expired', 'api');
      const mapped410 = mapApiError(err410);
      expect(mapped410.action).toBe('request_new_link');
      expect(mapped410.isNotFound).toBe(false);
      expect(mapped410.message).toBe('Link has expired');

      const err429 = new ApiError(429, 'Rate limit exceeded', 'api');
      const mapped429 = mapApiError(err429);
      expect(mapped429.action).toBe('none');
      expect(mapped429.isNotFound).toBe(false);
      expect(mapped429.message).toBe('Rate limit exceeded');

      // Other unmapped 4xx
      const err422 = new ApiError(422, 'Unprocessable entity', 'api');
      const mapped422 = mapApiError(err422);
      expect(mapped422.action).toBe('none');
      expect(mapped422.isNotFound).toBe(false);
    });

    it('mapApiError — 5xx: 502 and another 5xx with server message preserves server message and sets retry', () => {
      const err502 = new ApiError(502, 'Bad gateway upstream service down', 'api');
      const mapped502 = mapApiError(err502);
      expect(mapped502.status).toBe(502);
      expect(mapped502.message).toBe('Bad gateway upstream service down');
      expect(mapped502.action).toBe('retry');
      expect(mapped502.isNotFound).toBe(false);

      const err500 = new ApiError(500, 'Internal server error occurred', 'api');
      const mapped500 = mapApiError(err500);
      expect(mapped500.status).toBe(500);
      expect(mapped500.message).toBe('Internal server error occurred');
      expect(mapped500.action).toBe('retry');
      expect(mapped500.isNotFound).toBe(false);

      const err503 = new ApiError(503, 'Service unavailable for maintenance', 'api');
      const mapped503 = mapApiError(err503);
      expect(mapped503.status).toBe(503);
      expect(mapped503.message).toBe('Service unavailable for maintenance');
      expect(mapped503.action).toBe('retry');
    });

    it('mapApiError — unknown error: non-ApiError returns network-style generic retry UiError', () => {
      const nonApiErrors = [
        new Error('Unexpected JS runtime crash'),
        'just a string',
        null,
        undefined,
        { random: 'object' },
        12345,
      ];

      for (const nonErr of nonApiErrors) {
        const mapped = mapApiError(nonErr);
        expect(mapped).toEqual({
          status: 0,
          kind: 'network',
          message: GENERIC_NETWORK_MESSAGE,
          action: 'retry',
          isNotFound: false,
          isTimeout: false,
        });
      }
    });

    it('recognizes duck-typed ApiError from client boundary or serialization', () => {
      const boundaryError = {
        name: 'ApiError',
        status: 402,
        kind: 'api',
        message: 'Payment required from boundary',
      };
      const mapped = mapApiError(boundaryError);
      expect(mapped.status).toBe(402);
      expect(mapped.action).toBe('go_billing');
      expect(mapped.message).toBe('Payment required from boundary');

      const anonymousError = {
        status: 404,
        kind: 'api',
        message: 'Resource missing',
      };
      const mappedAnon = mapApiError(anonymousError);
      expect(mappedAnon.status).toBe(404);
      expect(mappedAnon.isNotFound).toBe(true);
      expect(mappedAnon.message).toBe('Resource missing');
    });
  });

  describe('applyServerErrorToForm (doc 11 §11.2.2)', () => {
    it('applyServerErrorToForm — default: sets root with server message and returns UiError', () => {
      const setErrorMock = vi.fn();
      const form = { setError: setErrorMock };
      const err = new ApiError(400, 'Invalid form input provided', 'api');

      const result = applyServerErrorToForm(err, form);

      expect(setErrorMock).toHaveBeenCalledTimes(1);
      expect(setErrorMock).toHaveBeenCalledWith('root', {
        type: 'server',
        message: 'Invalid form input provided',
      });
      expect(result.message).toBe('Invalid form input provided');
      expect(result.status).toBe(400);
    });

    it('applyServerErrorToForm — default on timeout: sets root with generic text', () => {
      const setErrorMock = vi.fn();
      const form = { setError: setErrorMock };
      const err = new ApiError(0, 'Request timed out', 'timeout');

      const result = applyServerErrorToForm(err, form);

      expect(setErrorMock).toHaveBeenCalledTimes(1);
      expect(setErrorMock).toHaveBeenCalledWith('root', {
        type: 'server',
        message: GENERIC_NETWORK_MESSAGE,
      });
      expect(result.message).toBe(GENERIC_NETWORK_MESSAGE);
      expect(result.isTimeout).toBe(true);
    });

    it('applyServerErrorToForm — register duplicate: 409 in register context sets email instead of root', () => {
      const setErrorMock = vi.fn();
      const form = { setError: setErrorMock };
      const err = new ApiError(409, 'Email is already registered', 'api');

      const result = applyServerErrorToForm(err, form, 'register');

      expect(setErrorMock).toHaveBeenCalledTimes(1);
      expect(setErrorMock).toHaveBeenCalledWith('email', {
        type: 'server',
        message: 'Email is already registered',
      });
      expect(setErrorMock).not.toHaveBeenCalledWith('root', expect.anything());
      expect(result.status).toBe(409);
      expect(result.action).toBe('refetch');
    });

    it('applyServerErrorToForm — wrong current password: 400 plus exact Current password is incorrect in change-password context sets currentPassword', () => {
      const setErrorMock = vi.fn();
      const form = { setError: setErrorMock };
      const err = new ApiError(400, SERVER_MESSAGES.currentPasswordIncorrect, 'api');

      const result = applyServerErrorToForm(err, form, 'changePassword');

      expect(setErrorMock).toHaveBeenCalledTimes(1);
      expect(setErrorMock).toHaveBeenCalledWith('currentPassword', {
        type: 'server',
        message: SERVER_MESSAGES.currentPasswordIncorrect,
      });
      expect(setErrorMock).not.toHaveBeenCalledWith('root', expect.anything());
      expect(result.status).toBe(400);
    });

    it('applyServerErrorToForm — invalid reset link: 400 plus exact Invalid reset link in reset context does not set a form field and returns UiError', () => {
      const setErrorMock = vi.fn();
      const form = { setError: setErrorMock };
      const err = new ApiError(400, SERVER_MESSAGES.invalidResetLink, 'api');

      const result = applyServerErrorToForm(err, form, 'resetPassword');

      expect(setErrorMock).not.toHaveBeenCalled();
      expect(result.status).toBe(400);
      expect(result.message).toBe(SERVER_MESSAGES.invalidResetLink);
    });

    it('applyServerErrorToForm — changed server message: 400 with a different message falls back safely to root', () => {
      const setErrorMock1 = vi.fn();
      const form1 = { setError: setErrorMock1 };
      const errChangePasswordOther = new ApiError(400, 'Password is too short or common', 'api');
      applyServerErrorToForm(errChangePasswordOther, form1, 'changePassword');
      expect(setErrorMock1).toHaveBeenCalledWith('root', {
        type: 'server',
        message: 'Password is too short or common',
      });

      const setErrorMock2 = vi.fn();
      const form2 = { setError: setErrorMock2 };
      const errResetPasswordOther = new ApiError(400, 'Token format invalid', 'api');
      applyServerErrorToForm(errResetPasswordOther, form2, 'resetPassword');
      expect(setErrorMock2).toHaveBeenCalledWith('root', {
        type: 'server',
        message: 'Token format invalid',
      });

      const setErrorMock3 = vi.fn();
      const form3 = { setError: setErrorMock3 };
      const errRegister400 = new ApiError(400, 'Password missing uppercase letter', 'api');
      applyServerErrorToForm(errRegister400, form3, 'register');
      expect(setErrorMock3).toHaveBeenCalledWith('root', {
        type: 'server',
        message: 'Password missing uppercase letter',
      });
    });
  });

  describe('handleGlobalApiError (doc 11 §11.2.2)', () => {
    let customClient: QueryClient;

    beforeEach(() => {
      customClient = new QueryClient();
    });

    it('handleGlobalApiError — billing: 402 invalidates queryKeys.subscription only', () => {
      const invalidateSpy = vi.spyOn(customClient, 'invalidateQueries');
      const err402 = new ApiError(402, 'Payment Required', 'api');

      handleGlobalApiError(err402, customClient);

      expect(invalidateSpy).toHaveBeenCalledTimes(1);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.subscription });
    });

    it('handleGlobalApiError — GitHub: 403 invalidates queryKeys.githubConnection only', () => {
      const invalidateSpy = vi.spyOn(customClient, 'invalidateQueries');
      const err403 = new ApiError(403, 'Forbidden: GitHub unlinked', 'api');

      handleGlobalApiError(err403, customClient);

      expect(invalidateSpy).toHaveBeenCalledTimes(1);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.githubConnection });
    });

    it('handleGlobalApiError — other errors: 400/404/500/network errors does not invalidate and does not navigate or show UI', () => {
      const invalidateSpy = vi.spyOn(customClient, 'invalidateQueries');

      const nonTriggerErrors = [
        new ApiError(400, 'Bad Request', 'api'),
        new ApiError(401, 'Unauthorized', 'api'),
        new ApiError(404, 'Not Found', 'api'),
        new ApiError(409, 'Conflict', 'api'),
        new ApiError(410, 'Gone', 'api'),
        new ApiError(429, 'Too Many Requests', 'api'),
        new ApiError(500, 'Internal Server Error', 'api'),
        new ApiError(502, 'Bad Gateway', 'api'),
        new ApiError(0, 'Offline', 'network'),
        new ApiError(0, 'Timeout', 'timeout'),
        new ApiError(200, 'Empty', 'unexpected_response'),
        new Error('Regular JavaScript error'),
      ];

      for (const err of nonTriggerErrors) {
        invalidateSpy.mockClear();
        handleGlobalApiError(err, customClient);
        expect(invalidateSpy).not.toHaveBeenCalled();
      }
    });

    it('handles duck-typed and Axios boundary error shapes for 402 and 403', () => {
      const invalidateSpy = vi.spyOn(customClient, 'invalidateQueries');

      handleGlobalApiError({ status: 402 }, customClient);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.subscription });

      invalidateSpy.mockClear();
      handleGlobalApiError({ response: { status: 403 } }, customClient);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.githubConnection });
    });
  });

  describe('shouldRetryQuery (doc 11 §11.2.2)', () => {
    it('shouldRetryQuery — retryable: network, timeout, 500+ with failureCount 0 returns true', () => {
      expect(shouldRetryQuery(0, new ApiError(0, 'Network down', 'network'))).toBe(true);
      expect(shouldRetryQuery(0, new ApiError(0, 'Request timed out', 'timeout'))).toBe(true);
      expect(shouldRetryQuery(0, new ApiError(500, 'Server crashed', 'api'))).toBe(true);
      expect(shouldRetryQuery(0, new ApiError(502, 'Bad Gateway', 'api'))).toBe(true);
      expect(shouldRetryQuery(0, new ApiError(503, 'Unavailable', 'api'))).toBe(true);
      expect(shouldRetryQuery(0, { kind: 'network' })).toBe(true);
      expect(shouldRetryQuery(0, { kind: 'timeout' })).toBe(true);
      expect(shouldRetryQuery(0, new AxiosError('Network Error', 'ERR_NETWORK'))).toBe(true);
      expect(shouldRetryQuery(0, new TypeError('Failed to fetch'))).toBe(true);
    });

    it('shouldRetryQuery — one retry exhausted: retryable error with failureCount 1 returns false', () => {
      expect(shouldRetryQuery(1, new ApiError(0, 'Network down', 'network'))).toBe(false);
      expect(shouldRetryQuery(1, new ApiError(0, 'Request timed out', 'timeout'))).toBe(false);
      expect(shouldRetryQuery(1, new ApiError(500, 'Server crashed', 'api'))).toBe(false);
      expect(shouldRetryQuery(1, new ApiError(502, 'Bad Gateway', 'api'))).toBe(false);
      expect(shouldRetryQuery(2, new ApiError(500, 'Server crashed', 'api'))).toBe(false);
      expect(shouldRetryQuery(1, { kind: 'network' })).toBe(false);
      expect(shouldRetryQuery(1, { status: 500 })).toBe(false);
    });

    it('shouldRetryQuery — 4xx: 400, 401, 402, 403, 404, 409, 410, 429 returns false', () => {
      const statuses = [400, 401, 402, 403, 404, 409, 410, 429];
      for (const status of statuses) {
        expect(shouldRetryQuery(0, new ApiError(status, 'Client error', 'api'))).toBe(false);
        expect(shouldRetryQuery(0, { status })).toBe(false);
      }
    });

    it('shouldRetryQuery — abort: aborted request error returns false', () => {
      const abortError = new DOMException('The user aborted a request.', 'AbortError');
      expect(shouldRetryQuery(0, abortError)).toBe(false);

      const cancelSource = axios.CancelToken.source();
      cancelSource.cancel('User canceled request');
      expect(shouldRetryQuery(0, new axios.Cancel('User canceled request'))).toBe(false);

      expect(shouldRetryQuery(0, new AxiosError('canceled', 'ERR_CANCELED'))).toBe(false);
      expect(shouldRetryQuery(0, { name: 'AbortError' })).toBe(false);
      expect(shouldRetryQuery(0, { name: 'CanceledError' })).toBe(false);
      expect(shouldRetryQuery(0, { kind: 'abort' })).toBe(false);
      expect(shouldRetryQuery(0, { code: 'ERR_CANCELED' })).toBe(false);
    });

    it('shouldRetryQuery — axios ECONNABORTED or timeout message returns true', () => {
      const econnaborted = new AxiosError(
        'timeout of 5000ms exceeded',
        'ECONNABORTED',
        undefined,
        undefined,
        { status: 504 } as unknown as AxiosResponse
      );
      expect(shouldRetryQuery(0, econnaborted)).toBe(true);

      const timeoutMsg = new AxiosError(
        'timeout of 5000ms exceeded',
        'UNKNOWN',
        undefined,
        undefined,
        { status: 504 } as unknown as AxiosResponse
      );
      expect(shouldRetryQuery(0, timeoutMsg)).toBe(true);
    });

    it('shouldRetryQuery — arbitrary unknown error returns false', () => {
      expect(shouldRetryQuery(0, new Error('Unknown logic error'))).toBe(false);
      expect(shouldRetryQuery(0, null)).toBe(false);
      expect(shouldRetryQuery(0, undefined)).toBe(false);
    });
  });

  describe('HTTP mocked at API client boundary with timers and cooldowns', () => {
    it('simulates API boundary failure mapped correctly and cooldown timer advancing', async () => {
      // Boundary mock simulating a timed-out call
      let errorThrown: unknown = null;
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new ApiError(0, 'Request timed out after limit', 'timeout'));
          }, 5000);
        });

        vi.advanceTimersByTime(5000);
        await timeoutPromise;
      } catch (err) {
        errorThrown = err;
      }

      expect(errorThrown).not.toBeNull();
      const uiError = mapApiError(errorThrown);
      expect(uiError.kind).toBe('timeout');
      expect(uiError.isTimeout).toBe(true);
      expect(uiError.action).toBe('retry');
      expect(uiError.message).toBe(GENERIC_NETWORK_MESSAGE);
      expect(shouldRetryQuery(0, errorThrown)).toBe(true);
      expect(shouldRetryQuery(1, errorThrown)).toBe(false);
    });

    it('handles status extracted via statusCode property', () => {
      const customClient = new QueryClient();
      const invalidateSpy = vi.spyOn(customClient, 'invalidateQueries');

      handleGlobalApiError({ statusCode: 402 }, customClient);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.subscription });

      invalidateSpy.mockClear();
      handleGlobalApiError({ statusCode: 403 }, customClient);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.githubConnection });

      const mapped = mapApiError({ name: 'ApiError', status: 400 });
      expect(mapped.status).toBe(400);
      expect(mapped.action).toBe('none');
    });
  });
});

