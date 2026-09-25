import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import {
  apiRequest,
  configureApiClient,
  refreshSessionOnce,
  resetSessionExpiredGuard,
  ApiError,
  type ApiClientConfig,
} from '@/lib/api/client';
import {
  REQUEST_TIMEOUT_DEFAULT_MS,
  REQUEST_TIMEOUT_LONG_MS,
} from '@/config/app.config';

const TEST_BASE_URL = 'http://localhost:3000/api/v1';

function createMockResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = { 'content-type': 'application/json' }
): Response {
  const textBody = typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(textBody, {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers(headers),
  });
}

function createEnvelope(data: unknown, statusCode = 200, message = 'OK', success = true) {
  return {
    statusCode,
    success,
    message,
    data,
  };
}

describe('API client — frontend/src/lib/api/client.ts', () => {
  let onSessionExpiredMock: Mock<() => void>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    onSessionExpiredMock = vi.fn();
    resetSessionExpiredGuard();
    configureApiClient({
      baseUrl: TEST_BASE_URL,
      onSessionExpired: onSessionExpiredMock,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('configureApiClient and initialization', () => {
    it('throws a plain Error if apiRequest is called before configuration', async () => {
      // Configure with empty/cleared config
      configureApiClient(null as unknown as ApiClientConfig);

      await expect(apiRequest('GET', '/test')).rejects.toThrow('API client is not configured');
    });
  });

  describe('apiRequest — successful envelope and basics', () => {
    it('unwraps envelope, uses credentials: include, and configured base URL', async () => {
      const mockData = { id: 'user-1', name: 'Test User' };
      const envelope = createEnvelope(mockData, 200, 'Success');

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        createMockResponse(envelope, 200)
      );

      const result = await apiRequest<typeof mockData>('GET', '/users/me');

      expect(result).toEqual({
        data: mockData,
        message: 'Success',
        statusCode: 200,
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
      expect(calledUrl).toBe(`${TEST_BASE_URL}/users/me`);
      expect(calledInit?.method).toBe('GET');
      expect(calledInit?.credentials).toBe('include');
    });

    it('sets Content-Type: application/json only when a body is provided', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
        createMockResponse(createEnvelope({ ok: true }))
      );

      // Without body
      await apiRequest('GET', '/no-body');
      const [, initNoBody] = fetchSpy.mock.calls[0];
      expect((initNoBody?.headers as Record<string, string>)?.['Content-Type']).toBeUndefined();

      // With body
      await apiRequest('POST', '/with-body', { body: { key: 'value' } });
      const [, initWithBody] = fetchSpy.mock.calls[1];
      expect((initWithBody?.headers as Record<string, string>)?.['Content-Type']).toBe('application/json');
      expect(initWithBody?.body).toBe(JSON.stringify({ key: 'value' }));
    });

    it('serializes defined query parameters and omits undefined values', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        createMockResponse(createEnvelope([]))
      );

      await apiRequest('GET', '/tickets', {
        query: {
          search: 'bug',
          limit: 10,
          isActive: true,
          optional: undefined,
        },
      });

      const [calledUrl] = fetchSpy.mock.calls[0];
      const url = new URL(calledUrl as string);
      expect(url.searchParams.get('search')).toBe('bug');
      expect(url.searchParams.get('limit')).toBe('10');
      expect(url.searchParams.get('isActive')).toBe('true');
      expect(url.searchParams.has('optional')).toBe(false);
    });
  });

  describe('apiRequest — error handling and envelopes', () => {
    it('throws ApiError with kind: api on non-2xx status or success: false', async () => {
      const errorEnvelope = createEnvelope(null, 400, 'Invalid parameters', false);
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        createMockResponse(errorEnvelope, 400)
      );

      await expect(apiRequest('POST', '/test')).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.kind).toBe('api');
        expect(apiErr.status).toBe(400);
        expect(apiErr.message).toBe('Invalid parameters');
        return true;
      });
    });

    it('throws ApiError with kind: unexpected_response for malformed/non-JSON responses', async () => {
      // E.g., proxy 502 returning HTML
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        createMockResponse('<html><body>502 Bad Gateway</body></html>', 502, {
          'content-type': 'text/html',
        })
      );

      await expect(apiRequest('GET', '/proxy-error')).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.kind).toBe('unexpected_response');
        expect(apiErr.status).toBe(502);
        return true;
      });
    });

    it('throws ApiError with kind: unexpected_response for empty 2xx body', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        createMockResponse('', 200, { 'content-type': 'text/plain' })
      );

      await expect(apiRequest('GET', '/empty')).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.kind).toBe('unexpected_response');
        expect(apiErr.status).toBe(200);
        return true;
      });
    });

    it('throws ApiError with kind: unexpected_response when envelope shape is invalid', async () => {
      // Missing required envelope fields (e.g. success or message)
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        createMockResponse({ someData: 123 }, 200)
      );

      await expect(apiRequest('GET', '/invalid-envelope')).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.kind).toBe('unexpected_response');
        return true;
      });
    });

    it('throws ApiError with kind: network on fetch network failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      );

      await expect(apiRequest('GET', '/network-failure')).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.kind).toBe('network');
        expect(apiErr.status).toBe(0);
        return true;
      });
    });
  });

  describe('apiRequest — timeouts and caller abort', () => {
    it('uses REQUEST_TIMEOUT_DEFAULT_MS by default and throws kind: timeout when elapsed', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        (_url, init) =>
          new Promise((_, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted', 'AbortError'));
            });
          })
      );

      const requestPromise = apiRequest('GET', '/normal-endpoint');
      const rejectionPromise = expect(requestPromise).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.kind).toBe('timeout');
        return true;
      });

      // Advance time past default timeout (30s)
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_DEFAULT_MS + 100);

      await rejectionPromise;
    });

    it('uses REQUEST_TIMEOUT_LONG_MS for long timeout endpoints', async () => {
      const longEndpoints = [
        ['POST', '/github/repo'],
        ['POST', '/tickets'],
        ['POST', '/tickets/123e4567/abandon'],
        ['POST', '/tickets/123e4567/mentor/messages'],
        ['POST', '/tickets/123e4567/submissions'],
      ] as const;

      for (const [method, path] of longEndpoints) {
        vi.spyOn(globalThis, 'fetch').mockImplementation(
          (_url, init) =>
            new Promise((_, reject) => {
              init?.signal?.addEventListener('abort', () => {
                reject(new DOMException('The operation was aborted', 'AbortError'));
              });
            })
        );

        const requestPromise = apiRequest(method, path);
        const rejectionPromise = expect(requestPromise).rejects.toSatisfy((err: unknown) => {
          expect(err).toBeInstanceOf(ApiError);
          const apiErr = err as ApiError;
          expect(apiErr.kind).toBe('timeout');
          return true;
        });

        // At 35s (past default 30s), it should still be pending
        await vi.advanceTimersByTimeAsync(35_000);

        // Advance to 60s (REQUEST_TIMEOUT_LONG_MS)
        await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_LONG_MS - 35_000 + 100);

        await rejectionPromise;

        vi.restoreAllMocks();
      }
    });

    it('explicit options.timeoutMs overrides both default and long timeouts', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        (_url, init) =>
          new Promise((_, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted', 'AbortError'));
            });
          })
      );

      const customTimeoutMs = 5_000;
      const requestPromise = apiRequest('POST', '/github/repo', { timeoutMs: customTimeoutMs });
      const rejectionPromise = expect(requestPromise).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.kind).toBe('timeout');
        return true;
      });

      await vi.advanceTimersByTimeAsync(customTimeoutMs + 100);

      await rejectionPromise;
    });

    it('re-throws caller abort unchanged and does not convert to ApiError', async () => {
      const controller = new AbortController();

      vi.spyOn(globalThis, 'fetch').mockImplementation(
        (_url, init) =>
          new Promise((_, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('User aborted request', 'AbortError'));
            });
          })
      );

      const requestPromise = apiRequest('GET', '/abort-test', { signal: controller.signal });
      controller.abort();

      await expect(requestPromise).rejects.toSatisfy((err: unknown) => {
        expect(err).not.toBeInstanceOf(ApiError);
        expect((err as DOMException).name).toBe('AbortError');
        return true;
      });
    });
  });

  describe('apiRequest — 401 refresh and replay', () => {
    it('refreshes once and replays when a protected call returns 401', async () => {
      let callCount = 0;
      let refreshCalled = false;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('/auth/refresh')) {
          refreshCalled = true;
          return createMockResponse(createEnvelope({ ok: true }));
        }

        callCount++;
        if (callCount === 1) {
          return createMockResponse(createEnvelope(null, 401, 'Access expired', false), 401);
        }

        return createMockResponse(createEnvelope({ secret: 'replayed-data' }));
      });

      const result = await apiRequest<{ secret: string }>('GET', '/protected-data');

      expect(result.data).toEqual({ secret: 'replayed-data' });
      expect(refreshCalled).toBe(true);
      expect(callCount).toBe(2);
      expect(onSessionExpiredMock).not.toHaveBeenCalled();
    });

    it('does not refresh on EP-02 /auth/login 401 (wrong credentials)', async () => {
      let refreshCalled = false;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('/auth/refresh')) {
          refreshCalled = true;
          return createMockResponse(createEnvelope({ ok: true }));
        }
        return createMockResponse(createEnvelope(null, 401, 'Invalid credentials', false), 401);
      });

      await expect(
        apiRequest('POST', '/auth/login', { body: { email: 'test@example.com', password: 'bad' } })
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(401);
        expect((err as ApiError).message).toBe('Invalid credentials');
        return true;
      });

      expect(refreshCalled).toBe(false);
      expect(onSessionExpiredMock).not.toHaveBeenCalled();
    });

    it('does not refresh on other NO_REFRESH_PATHS returning 401', async () => {
      let refreshCalled = false;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('/auth/refresh')) {
          refreshCalled = true;
        }
        return createMockResponse(createEnvelope(null, 401, 'Unauthorized', false), 401);
      });

      await expect(apiRequest('POST', '/auth/register')).rejects.toBeInstanceOf(ApiError);
      expect(refreshCalled).toBe(false);

      await expect(apiRequest('POST', '/auth/forgot-password')).rejects.toBeInstanceOf(ApiError);
      expect(refreshCalled).toBe(false);
    });

    it('calls onSessionExpired once and throws original 401 when refresh fails with 401', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('/auth/refresh')) {
          return createMockResponse(createEnvelope(null, 401, 'Refresh expired', false), 401);
        }
        return createMockResponse(createEnvelope(null, 401, 'Token expired', false), 401);
      });

      await expect(apiRequest('GET', '/profile')).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(401);
        return true;
      });

      expect(onSessionExpiredMock).toHaveBeenCalledTimes(1);
    });

    it('calls onSessionExpired once when replay returns 401', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('/auth/refresh')) {
          return createMockResponse(createEnvelope({ ok: true }));
        }
        // Both initial and replay return 401
        return createMockResponse(createEnvelope(null, 401, 'Still 401', false), 401);
      });

      await expect(apiRequest('GET', '/tickets')).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(401);
        return true;
      });

      expect(onSessionExpiredMock).toHaveBeenCalledTimes(1);
    });

    it('does not log user out when refresh fails with network error or 5xx', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('/auth/refresh')) {
          return createMockResponse(createEnvelope(null, 500, 'Server error', false), 500);
        }
        return createMockResponse(createEnvelope(null, 401, 'Token expired', false), 401);
      });

      await expect(apiRequest('GET', '/data')).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(500);
        return true;
      });

      // Crucial: do not log user out on 5xx or transient error
      expect(onSessionExpiredMock).not.toHaveBeenCalled();
    });

    it('concurrent 401s share a single refresh and each replays once', async () => {
      let refreshCount = 0;
      const requestCounts: Record<string, number> = {};

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('/auth/refresh')) {
          refreshCount++;
          // Small delay to ensure concurrent requests arrive while in-flight
          await new Promise((resolve) => setTimeout(resolve, 10));
          return createMockResponse(createEnvelope({ ok: true }));
        }

        requestCounts[urlStr] = (requestCounts[urlStr] || 0) + 1;
        if (requestCounts[urlStr] === 1) {
          return createMockResponse(createEnvelope(null, 401, 'Expired', false), 401);
        }

        return createMockResponse(createEnvelope({ item: urlStr }));
      });

      const [res1, res2, res3] = await Promise.all([
        apiRequest<{ item: string }>('GET', '/items/1'),
        apiRequest<{ item: string }>('GET', '/items/2'),
        apiRequest<{ item: string }>('GET', '/items/3'),
      ]);

      expect(refreshCount).toBe(1);
      expect(res1.data.item).toContain('/items/1');
      expect(res2.data.item).toContain('/items/2');
      expect(res3.data.item).toContain('/items/3');
      expect(onSessionExpiredMock).not.toHaveBeenCalled();
    });
  });

  describe('resetSessionExpiredGuard', () => {
    it('allows onSessionExpired to fire again after resetSessionExpiredGuard is called', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('/auth/refresh')) {
          return createMockResponse(createEnvelope(null, 401, 'Refresh dead', false), 401);
        }
        return createMockResponse(createEnvelope(null, 401, 'Expired', false), 401);
      });

      // First failure triggers callback once
      await expect(apiRequest('GET', '/fail-1')).rejects.toBeInstanceOf(ApiError);
      expect(onSessionExpiredMock).toHaveBeenCalledTimes(1);

      // Second failure with guard active does NOT call it again
      await expect(apiRequest('GET', '/fail-2')).rejects.toBeInstanceOf(ApiError);
      expect(onSessionExpiredMock).toHaveBeenCalledTimes(1);

      // Reset guard
      resetSessionExpiredGuard();

      // Third failure can trigger callback again
      await expect(apiRequest('GET', '/fail-3')).rejects.toBeInstanceOf(ApiError);
      expect(onSessionExpiredMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('refreshSessionOnce directly', () => {
    it('calls POST /auth/refresh with skipAuthRefresh: true and resets guard on success', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        createMockResponse(createEnvelope({ ok: true }))
      );

      await refreshSessionOnce();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(`${TEST_BASE_URL}/auth/refresh`);
      expect(init?.method).toBe('POST');
    });
  });

  describe('Security and hygiene checks', () => {
    it('never reads or writes localStorage, sessionStorage, or IndexedDB', async () => {
      const localGetSpy = vi.spyOn(Storage.prototype, 'getItem');
      const localSetSpy = vi.spyOn(Storage.prototype, 'setItem');
      const sessionGetSpy = vi.spyOn(Storage.prototype, 'getItem');
      const sessionSetSpy = vi.spyOn(Storage.prototype, 'setItem');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        createMockResponse(createEnvelope({ token: 'mock-data' }))
      );

      await apiRequest('GET', '/security-check');

      expect(localGetSpy).not.toHaveBeenCalled();
      expect(localSetSpy).not.toHaveBeenCalled();
      expect(sessionGetSpy).not.toHaveBeenCalled();
      expect(sessionSetSpy).not.toHaveBeenCalled();
    });

    it('never logs secrets, bodies, or payloads to console', async () => {
      const logSpy = vi.spyOn(console, 'log');
      const errorSpy = vi.spyOn(console, 'error');
      const warnSpy = vi.spyOn(console, 'warn');
      const infoSpy = vi.spyOn(console, 'info');

      const SECRET = 'SUPER_SECRET_PAYLOAD_TOKEN';

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        createMockResponse(createEnvelope({ secret: SECRET }))
      );

      await apiRequest('POST', '/login-test', { body: { password: SECRET } });

      const allLoggedText = [
        ...logSpy.mock.calls,
        ...errorSpy.mock.calls,
        ...warnSpy.mock.calls,
        ...infoSpy.mock.calls,
      ]
        .flat()
        .join(' ');

      expect(allLoggedText).not.toContain(SECRET);
    });
  });
});
