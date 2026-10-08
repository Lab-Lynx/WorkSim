import { Writable } from 'node:stream';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    METRICS_TOKEN: 'metrics_token_for_tests_1234',
    SENTRY_DSN: undefined,
  },
}));

import { LOG_REDACT_CENSOR, LOG_REDACT_PATHS } from '../../src/utils/logger.js';
import { metricsHandler, recordAiKeyFallback, recordAiRequest, recordAiTokens, metricsRegistry } from '../../src/lib/observability/metrics.js';
import { scrubSentryEvent, shouldReportError, captureServerError } from '../../src/lib/observability/sentry.js';
import ApiError from '../../src/utils/ApiError.js';
import type { Request, Response } from 'express';
import type { ErrorEvent } from '@sentry/node';

const captureLog = (log: (logger: pino.Logger) => void): Record<string, unknown> => {
  let output = '';
  const stream = new Writable({
    write(chunk, _enc, cb) {
      output += chunk.toString();
      cb();
    },
  });
  const logger = pino({ redact: { paths: LOG_REDACT_PATHS, censor: LOG_REDACT_CENSOR } }, stream);
  log(logger);
  return JSON.parse(output) as Record<string, unknown>;
};

describe('log redaction', () => {
  it('redacts cookies, authorization and signature headers from request logs', () => {
    const line = captureLog((logger) =>
      logger.info(
        {
          req: {
            headers: {
              cookie: 'accessToken=secret-access; refreshToken=secret-refresh',
              authorization: 'Bearer secret-bearer',
              'x-hub-signature-256': 'sha256=abc',
              'user-agent': 'vitest',
            },
          },
          res: { headers: { 'set-cookie': ['accessToken=secret-access'] } },
        },
        'request completed',
      ),
    );
    const serialized = JSON.stringify(line);
    expect(serialized).not.toContain('secret-access');
    expect(serialized).not.toContain('secret-refresh');
    expect(serialized).not.toContain('secret-bearer');
    expect(serialized).not.toContain('sha256=abc');
    expect(serialized).toContain('vitest');
  });

  it('redacts sensitive keys at top level and one level deep', () => {
    const line = captureLog((logger) =>
      logger.info({ password: 'hunter2', body: { refreshToken: 'tok-123', email: 'a@b.co' } }, 'login'),
    );
    const serialized = JSON.stringify(line);
    expect(serialized).not.toContain('hunter2');
    expect(serialized).not.toContain('tok-123');
    expect(serialized).toContain('a@b.co');
  });
});

describe('sentry scrubbing', () => {
  it('removes credentials, request bodies and user data from events', () => {
    const event = {
      request: {
        cookies: { accessToken: 'x' },
        data: { password: 'y' },
        query_string: 'token=z',
        headers: { Cookie: 'a=b', Authorization: 'Bearer q', 'User-Agent': 'ua' },
      },
      user: { id: '1', email: 'a@b.co' },
    } as unknown as ErrorEvent;

    const scrubbed = scrubSentryEvent(event);
    expect(scrubbed.request?.cookies).toBeUndefined();
    expect(scrubbed.request?.data).toBeUndefined();
    expect(scrubbed.request?.query_string).toBeUndefined();
    expect(scrubbed.request?.headers).toEqual({ 'User-Agent': 'ua' });
    expect(scrubbed.user).toBeUndefined();
  });

  it('only reports unexpected and 5xx errors', () => {
    expect(shouldReportError(new Error('boom'))).toBe(true);
    expect(shouldReportError(new ApiError(500, 'server'))).toBe(true);
    expect(shouldReportError(new ApiError(401, 'nope'))).toBe(false);
    expect(shouldReportError(new ApiError(404, 'missing'))).toBe(false);
  });

  it('is a no-op when Sentry is not initialised', () => {
    expect(() => captureServerError(new Error('boom'))).not.toThrow();
  });
});

describe('metrics', () => {
  const run = async (authorization?: string) => {
    const res = {
      statusCode: 200,
      body: undefined as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(body: unknown) {
        this.body = body;
        return this;
      },
      set: vi.fn(),
      send(body: unknown) {
        this.body = body;
        return this;
      },
    };
    const req = { get: (name: string) => (name.toLowerCase() === 'authorization' ? authorization : undefined) };
    await metricsHandler(req as unknown as Request, res as unknown as Response, vi.fn());
    return res;
  };

  it('rejects scrapes without the token', async () => {
    expect((await run()).statusCode).toBe(401);
    expect((await run('Bearer wrong_token_value_000')).statusCode).toBe(401);
  });

  it('exposes AI usage counters to an authorised scraper', async () => {
    recordAiRequest('gemini', 'mentor', 'success');
    recordAiTokens('gemini', 'mentor', 'test-model', { inputTokens: 10, outputTokens: 5 });
    recordAiKeyFallback('gemini', 'rate_limit');

    const res = await run('Bearer metrics_token_for_tests_1234');
    expect(res.statusCode).toBe(200);
    const body = String(res.body);
    expect(body).toContain('ai_requests_total{provider="gemini",operation="mentor",outcome="success"} 1');
    expect(body).toContain('ai_tokens_total{provider="gemini",operation="mentor",model="test-model",direction="input"} 10');
    expect(body).toContain('ai_key_fallbacks_total{provider="gemini",cause="rate_limit"} 1');
    expect(metricsRegistry.contentType).toContain('text/plain');
  });
});
