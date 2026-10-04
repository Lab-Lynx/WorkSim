import { describe, expect, it } from 'vitest';
import {
  decryptGitHubToken,
  encryptGitHubToken,
} from '../../../src/lib/crypto/github-token.js';

describe('GitHub token encryption', () => {
  it('round-trips tokens without storing the plaintext', () => {
    const token = 'github-token-secret';
    const encrypted = encryptGitHubToken(token);

    expect(encrypted).toMatch(/^v1\./);
    expect(encrypted).not.toContain(token);
    expect(decryptGitHubToken(encrypted)).toBe(token);
  });

  it('uses a fresh nonce for each encryption', () => {
    const first = encryptGitHubToken('github-token-secret');
    const second = encryptGitHubToken('github-token-secret');

    expect(second).not.toBe(first);
  });

  it('rejects tampered ciphertext', () => {
    const encrypted = encryptGitHubToken('github-token-secret');
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith('A') ? 'B' : 'A'}`;

    expect(() => decryptGitHubToken(tampered)).toThrow(
      'Invalid encrypted GitHub access token',
    );
  });

  it('rejects malformed and empty values', () => {
    expect(() => decryptGitHubToken('github-token-secret')).toThrow(
      'Invalid encrypted GitHub access token',
    );
    expect(() => encryptGitHubToken('')).toThrow('GitHub access token must not be empty');
  });
});
