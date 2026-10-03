import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    subscription: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    payment: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../src/integrations/chapa', () => ({
  initializeCheckout: vi.fn(),
  cancelChapaSubscription: vi.fn(),
  ChapaSubscriptionMechanismUndefinedError: class extends Error {},
}));

vi.mock('../../src/services/email.service', () => ({
  sendPaymentFailureEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { prisma } from '../../src/lib/prisma';
import { initializeCheckout, cancelChapaSubscription } from '../../src/integrations/chapa';
import { sendPaymentFailureEmail } from '../../src/services/email.service';
import { logger } from '../../src/lib/logger';
import {
  createCheckout,
  processChapaWebhook,
  getSubscriptionStatus,
  cancelSubscription,
  listPayments,
  hasPaidAccess,
} from '../../src/services/subscription.service';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUBSCRIPTION_PRICE_AMOUNT = '499';
  process.env.SUBSCRIPTION_PRICE_CURRENCY = 'ETB';
  process.env.CHAPA_WEBHOOK_CALLBACK_URL = 'https://api.example.com/webhooks/chapa';
  process.env.CHAPA_CHECKOUT_RETURN_URL = 'https://app.example.com/billing/return';
});

describe('createCheckout', () => {
  it('throws 403 if the email is not verified (D-01)', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      emailVerifiedAt: null,
    });
    await expect(createCheckout('u1')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 409 if an active subscription already exists', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      emailVerifiedAt: new Date(),
    });
    (prisma.subscription.findFirst as any).mockResolvedValue({ status: 'active' });
    await expect(createCheckout('u1')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws 409 if a past_due subscription already exists', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      emailVerifiedAt: new Date(),
    });
    (prisma.subscription.findFirst as any).mockResolvedValue({ status: 'past_due' });
    await expect(createCheckout('u1')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('creates a pending Payment with server-configured amount and returns the checkout URL', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      emailVerifiedAt: new Date(),
    });
    (prisma.subscription.findFirst as any).mockResolvedValue(null);
    (prisma.payment.create as any).mockResolvedValue({ id: 'pay1' });
    (initializeCheckout as any).mockResolvedValue({ checkoutUrl: 'https://checkout.chapa.co/x' });

    const result = await createCheckout('u1');

    expect(result).toEqual({ checkoutUrl: 'https://checkout.chapa.co/x' });
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: '499',
          currency: 'ETB',
          status: 'pending',
          userId: 'u1',
        }),
      }),
    );
  });

  it('never includes any card-related fields in the created Payment', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      emailVerifiedAt: new Date(),
    });
    (prisma.subscription.findFirst as any).mockResolvedValue(null);
    (prisma.payment.create as any).mockResolvedValue({ id: 'pay1' });
    (initializeCheckout as any).mockResolvedValue({ checkoutUrl: 'https://x' });

    await createCheckout('u1');

    const dataArg = (prisma.payment.create as any).mock.calls[0][0].data;
    expect(dataArg).not.toHaveProperty('cardNumber');
    expect(dataArg).not.toHaveProperty('cvv');
  });

  it('throws 502 and does not activate a subscription if Chapa fails', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      emailVerifiedAt: new Date(),
    });
    (prisma.subscription.findFirst as any).mockResolvedValue(null);
    (prisma.payment.create as any).mockResolvedValue({ id: 'pay1' });
    (initializeCheckout as any).mockRejectedValue(new Error('chapa down'));

    await expect(createCheckout('u1')).rejects.toMatchObject({ statusCode: 502 });
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });
});

describe('processChapaWebhook', () => {
  const successEvent = { tx_ref: 'tx-1', status: 'success' };
  const failEvent = { tx_ref: 'tx-2', status: 'failed' };

  it('logs a warning and does nothing for an unknown tx_ref', async () => {
    (prisma.payment.findUnique as any).mockResolvedValue(null);
    await processChapaWebhook(successEvent as any);
    expect(logger.warn).toHaveBeenCalled();
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it('is a no-op for a payment already in a terminal state (idempotent)', async () => {
    (prisma.payment.findUnique as any).mockResolvedValue({
      id: 'pay1',
      status: 'succeeded',
      userId: 'u1',
    });
    await processChapaWebhook(successEvent as any);
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it('first success creates a new subscription and links the payment', async () => {
    (prisma.payment.findUnique as any).mockResolvedValue({
      id: 'pay1',
      status: 'pending',
      userId: 'u1',
    });
    (prisma.payment.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.subscription.findFirst as any).mockResolvedValue(null);
    (prisma.subscription.create as any).mockResolvedValue({ id: 'sub1' });

    await processChapaWebhook(successEvent as any);

    expect(prisma.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'u1', status: 'active' }),
      }),
    );
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { subscriptionId: 'sub1' } }),
    );
  });

  it('success with an existing canceled subscription creates a NEW row (A-15)', async () => {
    (prisma.payment.findUnique as any).mockResolvedValue({
      id: 'pay1',
      status: 'pending',
      userId: 'u1',
    });
    (prisma.payment.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.subscription.findFirst as any).mockResolvedValue({ id: 'old-sub', status: 'canceled' });
    (prisma.subscription.create as any).mockResolvedValue({ id: 'new-sub' });

    await processChapaWebhook(successEvent as any);

    expect(prisma.subscription.create).toHaveBeenCalled();
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('success with an existing active/past_due subscription updates it instead of creating a new one', async () => {
    (prisma.payment.findUnique as any).mockResolvedValue({
      id: 'pay1',
      status: 'pending',
      userId: 'u1',
    });
    (prisma.payment.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.subscription.findFirst as any).mockResolvedValue({ id: 'sub1', status: 'past_due' });
    (prisma.subscription.update as any).mockResolvedValue({ id: 'sub1' });

    await processChapaWebhook(successEvent as any);

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub1' },
        data: expect.objectContaining({ status: 'active' }),
      }),
    );
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('failure sets the subscription past_due and sends the failure email, without undoing the payment write', async () => {
    (prisma.payment.findUnique as any).mockResolvedValue({
      id: 'pay2',
      status: 'pending',
      userId: 'u1',
    });
    (prisma.payment.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.subscription.findFirst as any).mockResolvedValue({
      id: 'sub1',
      status: 'active',
      currentPeriodEnd: new Date(),
    });
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'u1', email: 'a@b.com' });

    await processChapaWebhook(failEvent as any);

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'past_due' } }),
    );
    expect(sendPaymentFailureEmail).toHaveBeenCalled();
  });

  it('email failure does not roll back the already-persisted payment/subscription state', async () => {
    (prisma.payment.findUnique as any).mockResolvedValue({
      id: 'pay2',
      status: 'pending',
      userId: 'u1',
    });
    (prisma.payment.updateMany as any).mockResolvedValue({ count: 1 });
    (prisma.subscription.findFirst as any).mockResolvedValue({
      id: 'sub1',
      status: 'active',
      currentPeriodEnd: new Date(),
    });
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    (sendPaymentFailureEmail as any).mockRejectedValue(new Error('smtp down'));

    await expect(processChapaWebhook(failEvent as any)).resolves.not.toThrow();
    expect(prisma.subscription.update).toHaveBeenCalled(); // already happened before the email attempt
  });
});

describe('getSubscriptionStatus', () => {
  it('returns the latest subscription and hasAccess=true when currentPeriodEnd is in the future, regardless of status', async () => {
    const future = new Date(Date.now() + 100000);
    (prisma.subscription.findFirst as any).mockResolvedValue({
      id: 'sub1',
      status: 'canceled',
      currentPeriodEnd: future,
    });
    (prisma.subscription.count as any).mockResolvedValue(1);

    const result = await getSubscriptionStatus('u1');
    expect(result.hasAccess).toBe(true);
    expect(result.subscription?.status).toBe('canceled');
  });

  it('returns null subscription and hasAccess=false when none exists', async () => {
    (prisma.subscription.findFirst as any).mockResolvedValue(null);
    (prisma.subscription.count as any).mockResolvedValue(0);

    const result = await getSubscriptionStatus('u1');
    expect(result.subscription).toBeNull();
    expect(result.hasAccess).toBe(false);
  });
});

describe('cancelSubscription', () => {
  it('throws 409 if there is no active/past_due subscription', async () => {
    (prisma.subscription.findFirst as any).mockResolvedValue(null);
    await expect(cancelSubscription('u1')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws 502 and does not mark canceled locally when the Chapa call fails', async () => {
    (prisma.subscription.findFirst as any).mockResolvedValue({ id: 'sub1', status: 'active' });
    (cancelChapaSubscription as any).mockRejectedValue(new Error('not implemented'));

    await expect(cancelSubscription('u1')).rejects.toMatchObject({ statusCode: 502 });
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('marks canceled and sets canceledAt once Chapa confirms (future-proofing for when Q-05 resolves)', async () => {
    (prisma.subscription.findFirst as any).mockResolvedValue({ id: 'sub1', status: 'active' });
    (cancelChapaSubscription as any).mockResolvedValue(undefined);
    (prisma.subscription.update as any).mockResolvedValue({ id: 'sub1', status: 'canceled' });

    await cancelSubscription('u1');

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'canceled', canceledAt: expect.any(Date) }),
      }),
    );
  });
});

describe('listPayments', () => {
  it('returns payments newest first', async () => {
    (prisma.payment.findMany as any).mockResolvedValue([{ id: 'p2' }, { id: 'p1' }]);
    const result = await listPayments('u1');
    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
    expect(result).toEqual([{ id: 'p2' }, { id: 'p1' }]);
  });

  it('never includes chapaTxRef in the query selection', async () => {
    (prisma.payment.findMany as any).mockResolvedValue([]);
    await listPayments('u1');
    const callArgs = (prisma.payment.findMany as any).mock.calls[0][0];
    expect(callArgs.select).not.toHaveProperty('chapaTxRef');
  });
});

describe('hasPaidAccess', () => {
  it('returns true when currentPeriodEnd is in the future', async () => {
    (prisma.subscription.count as any).mockResolvedValue(1);
    expect(await hasPaidAccess('u1', new Date('2026-01-01'))).toBe(true);
  });

  it('returns false when no subscription has a future currentPeriodEnd', async () => {
    (prisma.subscription.count as any).mockResolvedValue(0);
    expect(await hasPaidAccess('u1', new Date('2026-01-01'))).toBe(false);
  });

  it('queries with a strict greater-than, so exactly-at-period-end is false', async () => {
    (prisma.subscription.count as any).mockResolvedValue(0);
    const now = new Date('2026-01-01T00:00:00Z');
    await hasPaidAccess('u1', now);
    expect(prisma.subscription.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ currentPeriodEnd: { gt: now } }),
      }),
    );
  });
});
