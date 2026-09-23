import { compareToken, hashToken } from '../../../src/lib/crypto/token-hash.js';

describe('token hash helpers', () => {
  it('hashes verification and reset tokens before storage', () => {
    const rawToken = 'verification-or-reset-token';

    expect(hashToken(rawToken)).toBe(
      'bfe90ddb154e48f37b658e3de3f57dfd814d211e43d7908927f0ca18146d8b45',
    );
    expect(hashToken(rawToken)).not.toBe(rawToken);
  });

  it.each([
    ['verify-email-token', 'verify-email-token'],
    ['reset-password-token', 'reset-password-token'],
  ])('compares the raw %s token to its stored hash', (rawToken, comparedToken) => {
    expect(compareToken(rawToken, hashToken(comparedToken))).toBe(true);
  });

  it('rejects a different raw token', () => {
    expect(compareToken('wrong-token', hashToken('reset-password-token'))).toBe(false);
  });

  it('rejects malformed stored hashes without throwing', () => {
    expect(compareToken('reset-password-token', 'not-a-sha256-hash')).toBe(false);
  });
});
