import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/react';
import { captureClientError, scrubSentryEvent } from '@/lib/observability/sentry';

describe('scrubSentryEvent', () => {
  it('drops cookies, headers, bodies, user data and URL query strings', () => {
    const event = {
      request: {
        url: 'https://app.example.com/reset-password?token=secret-token',
        cookies: { a: 'b' },
        headers: { Cookie: 'a=b' },
        data: { password: 'x' },
        query_string: 'token=secret-token',
      },
      user: { id: '1', email: 'a@b.co' },
      breadcrumbs: [
        { category: 'navigation', data: { from: '/login?next=%2Fa', to: '/verify-email?token=abc' } },
        { category: 'console', message: 'hello' },
      ],
    } as unknown as ErrorEvent;

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.request?.url).toBe('https://app.example.com/reset-password');
    expect(scrubbed.request?.cookies).toBeUndefined();
    expect(scrubbed.request?.headers).toBeUndefined();
    expect(scrubbed.request?.data).toBeUndefined();
    expect(scrubbed.request?.query_string).toBeUndefined();
    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.breadcrumbs?.[0]?.data).toEqual({ from: '/login', to: '/verify-email' });
    expect(scrubbed.breadcrumbs?.[1]?.message).toBe('hello');
  });
});

describe('captureClientError', () => {
  it('does nothing when Sentry has not been initialised', () => {
    expect(() => captureClientError(new Error('boom'))).not.toThrow();
  });
});
