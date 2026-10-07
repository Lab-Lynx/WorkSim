import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const { initializeCheckout } = await import('../../src/integrations/chapa.js');

const params = {
  amount: '450',
  currency: 'ETB',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  txRef: 'ws-123',
  callbackUrl: 'https://api.example.com/api/v1/webhooks/chapa',
  returnUrl: 'https://app.example.com/payment/return',
};

describe('initializeCheckout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CHAPA_SECRET_KEY', 'CHASECK_TEST-fake');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('returns the checkout url on success', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'success', data: { checkout_url: 'https://checkout.chapa.co/x' } }),
    });

    await expect(initializeCheckout(params)).resolves.toEqual({
      checkoutUrl: 'https://checkout.chapa.co/x',
    });
  });

  it('reports a rejected email as a 422 instead of a generic gateway error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        status: 'failed',
        message: { email: ['The email must be a valid email address.'] },
      }),
    });

    await expect(initializeCheckout(params)).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('email'),
    });
  });

  it('keeps other provider failures as a 502', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ status: 'failed', message: 'Something went wrong' }),
    });

    await expect(initializeCheckout(params)).rejects.toMatchObject({ statusCode: 502 });
  });
});
