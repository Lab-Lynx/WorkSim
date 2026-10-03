import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyChapaSignature, verifyGitHubSignature } from '../../../src/lib/webhooks/signature.js';

const body = Buffer.from('{"event":"charge.success","tx_ref":"tx-123"}', 'utf8');

describe('webhook signature verification', () => {
  it('verifies Chapa signatures against raw bytes', () => {
    const signature = crypto.createHmac('sha256', 'chapa-secret').update(body).digest('hex');

    expect(verifyChapaSignature(body, signature, 'chapa-secret')).toBe(true);
    expect(verifyChapaSignature(Buffer.from(body.toString() + ' '), signature, 'chapa-secret')).toBe(false);
  });

  it('verifies GitHub signatures and rejects malformed headers', () => {
    const digest = crypto.createHmac('sha256', 'github-secret').update(body).digest('hex');

    expect(verifyGitHubSignature(body, `sha256=${digest}`, 'github-secret')).toBe(true);
    expect(verifyGitHubSignature(body, digest, 'github-secret')).toBe(false);
    expect(verifyGitHubSignature(body, `sha256=${digest.slice(0, -1)}0`, 'github-secret')).toBe(false);
  });
});
