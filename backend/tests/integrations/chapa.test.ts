import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  initializeCheckout,
  verifyTransaction,
  verifyChapaWebhookSignature,
  initiateRenewalCheckout,
  cancelChapaSubscription,
  ChapaProviderError,
  ChapaSubscriptionMechanismUndefinedError,
} from '../../src/integrations/chapa';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CHAPA_SECRET_KEY = 'CHASECK_TEST-fake-key';
  process.env.CHAPA_WEBHOOK_SECRET = 'test-webhook-secret';
});

function signBody(rawBody: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

describe('initializeCheckout', () => {
  it('calls the real Chapa initialize endpoint and returns the checkout URL', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        data: { checkout_url: 'https://checkout.chapa.co/x' },
      }),
    }) as any;

    const result = await initializeCheckout({
      amount: '499',
      currency: 'ETB',
      email: 'user@example.com',
      txRef: 'tx-ref-123',
      callbackUrl: 'https://api.example.com/webhooks/chapa',
      returnUrl: 'https://app.example.com/billing/return',
    });

    expect(result).toEqual({ checkoutUrl: 'https://checkout.chapa.co/x' });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.chapa.co/v1/transaction/initialize',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer CHASECK_TEST-fake-key' }),
      }),
    );
  });

  it('normalizes a Chapa error response to ChapaProviderError, never leaking the secret key', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ status: 'failed', message: 'Invalid amount' }),
    }) as any;

    try {
      await initializeCheckout({
        amount: '-1',
        currency: 'ETB',
        email: 'a@b.com',
        txRef: 'tx-1',
        callbackUrl: 'https://x',
        returnUrl: 'https://y',
      });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ChapaProviderError);
      expect((err as Error).message).not.toContain('CHASECK_TEST-fake-key');
    }
  });

  it('normalizes a network failure to ChapaProviderError', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    await expect(
      initializeCheckout({
        amount: '499',
        currency: 'ETB',
        email: 'a@b.com',
        txRef: 'tx-2',
        callbackUrl: 'https://x',
        returnUrl: 'https://y',
      }),
    ).rejects.toThrow(ChapaProviderError);
  });
});

describe('verifyTransaction', () => {
  it('calls the real Chapa verify endpoint with the tx_ref in the path', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        data: { status: 'success', amount: '499', currency: 'ETB' },
      }),
    }) as any;

    const result = await verifyTransaction('tx-ref-123');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.chapa.co/v1/transaction/verify/tx-ref-123',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.status).toBe('success');
  });

  it('normalizes a failed verification to ChapaProviderError', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ status: 'failed', message: 'Transaction not found' }),
    }) as any;

    await expect(verifyTransaction('unknown-ref')).rejects.toThrow(ChapaProviderError);
  });
});

describe('verifyChapaWebhookSignature', () => {
  it('accepts a valid x-chapa-signature header', () => {
    const rawBody = Buffer.from(JSON.stringify({ tx_ref: 'x' }));
    const sig = signBody(rawBody.toString(), 'test-webhook-secret');
    expect(verifyChapaWebhookSignature(rawBody, { xChapaSignature: sig })).toBe(true);
  });

  it('accepts a valid chapa-signature header when x-chapa-signature is absent', () => {
    const rawBody = Buffer.from(JSON.stringify({ tx_ref: 'x' }));
    const sig = signBody(rawBody.toString(), 'test-webhook-secret');
    expect(verifyChapaWebhookSignature(rawBody, { chapaSignature: sig })).toBe(true);
  });

  it('accepts if only ONE of the two headers is valid', () => {
    const rawBody = Buffer.from(JSON.stringify({ tx_ref: 'x' }));
    const validSig = signBody(rawBody.toString(), 'test-webhook-secret');
    expect(
      verifyChapaWebhookSignature(rawBody, {
        chapaSignature: 'garbage',
        xChapaSignature: validSig,
      }),
    ).toBe(true);
  });

  it('rejects when neither header is present', () => {
    const rawBody = Buffer.from(JSON.stringify({ tx_ref: 'x' }));
    expect(verifyChapaWebhookSignature(rawBody, {})).toBe(false);
  });

  it('rejects when both headers are invalid', () => {
    const rawBody = Buffer.from(JSON.stringify({ tx_ref: 'x' }));
    expect(
      verifyChapaWebhookSignature(rawBody, { chapaSignature: 'bad1', xChapaSignature: 'bad2' }),
    ).toBe(false);
  });
});

describe('initiateRenewalCheckout', () => {
  it('behaves identically to initializeCheckout — same real endpoint, no invented renewal API', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        data: { checkout_url: 'https://checkout.chapa.co/renewal' },
      }),
    }) as any;

    const result = await initiateRenewalCheckout({
      amount: '499',
      currency: 'ETB',
      email: 'a@b.com',
      txRef: 'renewal-tx-1',
      callbackUrl: 'https://x',
      returnUrl: 'https://y',
    });

    expect(result).toEqual({ checkoutUrl: 'https://checkout.chapa.co/renewal' });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.chapa.co/v1/transaction/initialize',
      expect.anything(),
    );
  });
});

describe('cancelChapaSubscription', () => {
  it('throws a clear, typed error and makes no network call at all', async () => {
    global.fetch = vi.fn();

    await expect(cancelChapaSubscription('some-ref')).rejects.toThrow(
      ChapaSubscriptionMechanismUndefinedError,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
