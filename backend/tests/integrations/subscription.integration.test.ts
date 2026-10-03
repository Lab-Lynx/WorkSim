import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { resetDatabase, createTestUser } from '../helpers/db';

vi.mock('../../src/integrations/chapa', async () => {
  const actual = await vi.importActual<typeof import('../../src/integrations/chapa')>(
    '../../src/integrations/chapa',
  );
  return {
    ...actual, // keep the REAL verifyChapaWebhookSignature — it's ours, not Chapa's network call
    initializeCheckout: vi.fn(),
    cancelChapaSubscription: vi.fn(),
  };
});

import { initializeCheckout, cancelChapaSubscription } from '../../src/integrations/chapa';

const WEBHOOK_SECRET = 'test-webhook-secret';

function signBody(rawBody: string): string {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
}

beforeEach(async () => {
  vi.clearAllMocks();
  await resetDatabase();
  process.env.CHAPA_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.SUBSCRIPTION_PRICE_AMOUNT = '499';
  process.env.SUBSCRIPTION_PRICE_CURRENCY = 'ETB';
  process.env.CHAPA_WEBHOOK_CALLBACK_URL = 'https://api.example.com/webhooks/chapa';
  process.env.CHAPA_CHECKOUT_RETURN_URL = 'https://app.example.com/billing/return';
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('subscription flow (integration)', () => {
  it('rejects checkout with 403 when the user is not email-verified', async () => {
    const { agent } = await createTestUser({ withVerifiedEmail: false });
    const res = await agent.post('/api/v1/subscriptions/checkout');
    expect(res.status).toBe(403);
  });

  it('creates a real pending Payment row on checkout', async () => {
    const { agent, userId } = await createTestUser({ withVerifiedEmail: true });
    (initializeCheckout as any).mockResolvedValue({ checkoutUrl: 'https://checkout.chapa.co/x' });

    const res = await agent.post('/api/v1/subscriptions/checkout').expect(201);
    expect(res.body.data.checkoutUrl).toBe('https://checkout.chapa.co/x');

    const payment = await prisma.payment.findFirst({ where: { userId } });
    expect(payment).not.toBeNull();
    expect(payment!.status).toBe('pending');
  });

  it('a verified webhook with valid signature activates the subscription (real DB write)', async () => {
    const { agent, userId } = await createTestUser({ withVerifiedEmail: true });
    (initializeCheckout as any).mockResolvedValue({ checkoutUrl: 'https://x' });
    await agent.post('/api/v1/subscriptions/checkout').expect(201);

    const payment = await prisma.payment.findFirst({ where: { userId } });
    const body = JSON.stringify({ tx_ref: payment!.chapaTxRef, status: 'success' });

    const res = await request(app)
      .post('/api/v1/webhooks/chapa')
      .set('Content-Type', 'application/json')
      .set('x-chapa-signature', signBody(body))
      .send(body);

    expect(res.status).toBe(200);

    const subscription = await prisma.subscription.findFirst({ where: { userId } });
    expect(subscription).not.toBeNull();
    expect(subscription!.status).toBe('active');

    const statusRes = await agent.get('/api/v1/subscriptions/me').expect(200);
    expect(statusRes.body.data.hasAccess).toBe(true);
  });

  it('a duplicate delivery of the same webhook is a no-op', async () => {
    const { agent, userId } = await createTestUser({ withVerifiedEmail: true });
    (initializeCheckout as any).mockResolvedValue({ checkoutUrl: 'https://x' });
    await agent.post('/api/v1/subscriptions/checkout').expect(201);

    const payment = await prisma.payment.findFirst({ where: { userId } });
    const body = JSON.stringify({ tx_ref: payment!.chapaTxRef, status: 'success' });
    const signature = signBody(body);

    await request(app)
      .post('/api/v1/webhooks/chapa')
      .set('Content-Type', 'application/json')
      .set('x-chapa-signature', signature)
      .send(body)
      .expect(200);

    const firstSubscription = await prisma.subscription.findFirst({ where: { userId } });

    // Second, identical delivery — same tx_ref, already 'succeeded'
    await request(app)
      .post('/api/v1/webhooks/chapa')
      .set('Content-Type', 'application/json')
      .set('x-chapa-signature', signature)
      .send(body)
      .expect(200);

    const subscriptionsAfter = await prisma.subscription.findMany({ where: { userId } });
    expect(subscriptionsAfter).toHaveLength(1); // no second subscription row created
    expect(subscriptionsAfter[0].id).toBe(firstSubscription!.id);
  });

  it('rejects a bad signature with 401 and makes no mutation at all', async () => {
    const { agent, userId } = await createTestUser({ withVerifiedEmail: true });
    (initializeCheckout as any).mockResolvedValue({ checkoutUrl: 'https://x' });
    await agent.post('/api/v1/subscriptions/checkout').expect(201);

    const payment = await prisma.payment.findFirst({ where: { userId } });
    const body = JSON.stringify({ tx_ref: payment!.chapaTxRef, status: 'success' });

    const res = await request(app)
      .post('/api/v1/webhooks/chapa')
      .set('Content-Type', 'application/json')
      .set('x-chapa-signature', 'totally-wrong-signature')
      .send(body);

    expect(res.status).toBe(401);

    const unchangedPayment = await prisma.payment.findUnique({ where: { id: payment!.id } });
    expect(unchangedPayment!.status).toBe('pending'); // untouched
  });

  it('cancel keeps access until currentPeriodEnd, once Chapa confirms (provider mocked)', async () => {
    const { agent, userId } = await createTestUser({ withVerifiedEmail: true });
    (initializeCheckout as any).mockResolvedValue({ checkoutUrl: 'https://x' });
    await agent.post('/api/v1/subscriptions/checkout').expect(201);
    const payment = await prisma.payment.findFirst({ where: { userId } });
    const body = JSON.stringify({ tx_ref: payment!.chapaTxRef, status: 'success' });
    await request(app)
      .post('/api/v1/webhooks/chapa')
      .set('Content-Type', 'application/json')
      .set('x-chapa-signature', signBody(body))
      .send(body)
      .expect(200);

    (cancelChapaSubscription as any).mockResolvedValue(undefined); // Chapa succeeds, per this test's scope

    const res = await agent.post('/api/v1/subscriptions/cancel').expect(200);
    expect(res.body.data.subscription.status).toBe('canceled');

    const statusRes = await agent.get('/api/v1/subscriptions/me').expect(200);
    expect(statusRes.body.data.hasAccess).toBe(true); // currentPeriodEnd hasn't passed yet
  });

  it('payment history never exposes chapaTxRef', async () => {
    const { agent, userId } = await createTestUser({ withVerifiedEmail: true });
    (initializeCheckout as any).mockResolvedValue({ checkoutUrl: 'https://x' });
    await agent.post('/api/v1/subscriptions/checkout').expect(201);

    const payment = await prisma.payment.findFirst({ where: { userId } });
    const res = await agent.get('/api/v1/payments').expect(200);

    expect(JSON.stringify(res.body)).not.toContain(payment!.chapaTxRef);
  });
});
