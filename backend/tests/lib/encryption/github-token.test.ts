import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import { encryptGitHubToken, decryptGitHubToken } from '../../../src/lib/encryption/github-token';

const VALID_KEY = crypto.randomBytes(32).toString('hex');

describe('github-token encryption', () => {
  const originalEnv = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = VALID_KEY;
  });

  afterEach(() => {
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = originalEnv;
    vi.restoreAllMocks();
  });

  it('round-trips: decrypting an encrypted token returns the original token', () => {
    const token = 'gho_16C7e42F292c6912E7710c838347Ae178B4a';
    const encrypted = encryptGitHubToken(token);
    expect(decryptGitHubToken(encrypted)).toBe(token);
  });

  it('produces different ciphertext for the same token on repeated calls', () => {
    const token = 'gho_sometoken';
    expect(encryptGitHubToken(token)).not.toBe(encryptGitHubToken(token));
  });

  it('throws when decrypting with the wrong key', () => {
    const encrypted = encryptGitHubToken('gho_sometoken');
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    expect(() => decryptGitHubToken(encrypted)).toThrow();
  });

  it('throws when the encrypted value has been corrupted/tampered with', () => {
    const encrypted = encryptGitHubToken('gho_sometoken');
    const tampered = encrypted.slice(0, -4) + 'ffff';
    expect(() => decryptGitHubToken(tampered)).toThrow();
  });

  it('throws on a malformed encrypted value (wrong format entirely)', () => {
    expect(() => decryptGitHubToken('not-a-real-encrypted-value')).toThrow();
  });

  it('throws a clear error if the encryption key is missing', () => {
    delete process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
    expect(() => encryptGitHubToken('gho_sometoken')).toThrow();
  });

  it('never logs the plaintext token', () => {
    const token = 'gho_sensitive_value_should_never_appear_in_logs';
    const logSpy = vi.spyOn(console, 'log');
    const errorSpy = vi.spyOn(console, 'error');

    decryptGitHubToken(encryptGitHubToken(token));

    const allLoggedText = [...logSpy.mock.calls, ...errorSpy.mock.calls].flat().join(' ');
    expect(allLoggedText).not.toContain(token);
  });
});
