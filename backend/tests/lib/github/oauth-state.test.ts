import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createOAuthState,
  verifyOAuthState,
  OAuthStateError,
} from '../../../src/lib/github/oauth-state';

const originalSecret = process.env.GITHUB_OAUTH_STATE_SECRET;

describe('oauth-state', () => {
  beforeEach(() => {
    process.env.GITHUB_OAUTH_STATE_SECRET = 'test-secret-value';
  });

  afterEach(() => {
    process.env.GITHUB_OAUTH_STATE_SECRET = originalSecret;
    vi.useRealTimers();
  });

  it('accepts a valid state for the user it was created for', () => {
    const state = createOAuthState('user-123');
    expect(() => verifyOAuthState(state, 'user-123')).not.toThrow();
  });

  it('rejects a state when the expected user does not match', () => {
    const state = createOAuthState('user-123');
    expect(() => verifyOAuthState(state, 'user-456')).toThrow(OAuthStateError);
  });

  it('rejects an expired state', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const state = createOAuthState('user-123');

    vi.setSystemTime(new Date('2026-01-01T00:15:00Z')); // 15 min later, past TTL

    expect(() => verifyOAuthState(state, 'user-123')).toThrow(OAuthStateError);
  });

  it('rejects a tampered state (payload altered after signing)', () => {
    const state = createOAuthState('user-123');
    const [payload, signature] = state.split('.');
    const tamperedPayload = payload.slice(0, -2) + 'zz';
    expect(() => verifyOAuthState(`${tamperedPayload}.${signature}`, 'user-123')).toThrow(
      OAuthStateError,
    );
  });

  it('rejects a state signed with a different secret', () => {
    const state = createOAuthState('user-123');
    process.env.GITHUB_OAUTH_STATE_SECRET = 'a-different-secret';
    expect(() => verifyOAuthState(state, 'user-123')).toThrow(OAuthStateError);
  });

  it('rejects a malformed state string', () => {
    expect(() => verifyOAuthState('not-a-real-state', 'user-123')).toThrow(OAuthStateError);
  });

  it('every rejection is categorized as state_invalid, matching the callback error contract', () => {
    const state = createOAuthState('user-123');
    try {
      verifyOAuthState(state, 'someone-else');
      throw new Error('expected verifyOAuthState to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(OAuthStateError);
      expect((err as OAuthStateError).code).toBe('state_invalid');
    }
  });

  it('throws clearly if the signing secret is missing', () => {
    delete process.env.GITHUB_OAUTH_STATE_SECRET;
    expect(() => createOAuthState('user-123')).toThrow();
  });
});
