import { describe, expect, it } from 'vitest';
import { ApiError, GENERIC_NETWORK_MESSAGE } from '@/lib/api/errors';
import { friendlyMessage } from '@/lib/api/friendly-error';

const FALLBACK = 'We could not load this.';

describe('friendlyMessage', () => {
  it('returns the server message for client errors', () => {
    const error = new ApiError(400, 'Current password is incorrect', 'api');
    expect(friendlyMessage(error, FALLBACK)).toBe('Current password is incorrect');
  });

  it('hides route names that leak server internals', () => {
    const error = new ApiError(404, 'Route GET /api/v1/subscriptions/me not found', 'api');
    expect(friendlyMessage(error, FALLBACK)).toBe(FALLBACK);
  });

  it('hides messages that contain an API path', () => {
    const error = new ApiError(400, 'Failed calling /api/v1/github/repo', 'api');
    expect(friendlyMessage(error, FALLBACK)).toBe(FALLBACK);
  });

  it('hides 5xx details behind the fallback', () => {
    const error = new ApiError(502, 'Provider unavailable', 'api');
    expect(friendlyMessage(error, FALLBACK)).toBe(FALLBACK);
  });

  it('shows the generic network message for non-API errors', () => {
    expect(friendlyMessage(new Error('boom'), FALLBACK)).toBe(GENERIC_NETWORK_MESSAGE);
  });
});
