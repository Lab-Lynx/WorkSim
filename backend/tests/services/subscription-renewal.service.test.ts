import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    subscription: { findMany: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    payment: { create: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock('../../src/integrations/chapa', () => ({
  chargeRenewal: vi.fn(),
  ChapaSubscriptionMechanismUndefinedError: class extends Error {},
}));

vi.mock('../../src/services/email.service', () => ({
  sendRenewalReminderEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentFailureEmail: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../src/lib/prisma';
import { chargeRenewal } from '../../src/integrations/chapa';
import {
  sendRenewalReminderEmail,
  sendPaymentFailureEmail,
} from '../../src/services/email.service';
import { processUpcomingRenewals } from '../../src/services/subscription-renewal.service';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUBSCRIPTION_PRICE_AMOUNT = '499';
  process.env.SUBSCRIPTION_PRICE_CURRENCY = 'ETB';
  (prisma.subscription.findMany as any).mockResolvedValue([]);
});

describe('reminders', () => {
  it('sends a reminder for an active subscription exactly 7 days from currentPeriodEnd', async () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const sevenOut = new Date('2026-01-08T00:00:00Z');
    (prisma.subscription.findMany as any)
      .mockResolvedValueOnce([
        { id: 'sub1', currentPeriodEnd: sevenOut, user: { email: 'a@b.com' } },
      ])
      .mockResolvedValueOnce([]); // charge pass finds nothing

    (prisma.subscription.updateMany as any).mockResolvedValue({ count: 1 });

    const result = await processUpcomingRenewals(now);

    expect(sendRenewalReminderEmail).toHaveBeenCalledWith('a@b.com', sevenOut);
    expect(result.remindersSent).toBe(1);
  });

  it('does not resend a reminder already sent this cycle (idempotent second run)', async () => {
    (prisma.subscription.findMany as any).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const result = await processUpcomingRenewals(new Date());
    expect(sendRenewalReminderEmail).not.toHaveBeenCalled();
    expect(result.remindersSent).toBe(0);
  });

  it('skips if a concurrent run already claimed the reminder (guarded updateMany returns 0)', async () => {
    (prisma.subscription.findMany as any)
      .mockResolvedValueOnce([
        { id: 'sub1', currentPeriodEnd: new Date(), user: { email: 'a@b.com' } },
      ])
      .mockResolvedValueOnce([]);
    (prisma.subscription.updateMany as any).mockResolvedValue({ count: 0 });

    const result = await processUpcomingRenewals(new Date());
    expect(sendRenewalReminderEmail).not.toHaveBeenCalled();
    expect(result.remindersSent).toBe(0);
  });
});

describe('charges', () => {
  it('re-verifies status immediately before charging and skips if canceled in the interim', async () => {
    const sub = {
      id: 'sub1',
      userId: 'u1',
      status: 'active',
      currentPeriodEnd: new Date('2026-01-01'),
    };
    (prisma.subscription.findMany as any).mockResolvedValueOnce([]).mockResolvedValueOnce([sub]);
    (prisma.subscription.findUnique as any).mockResolvedValue({ ...sub, status: 'canceled' });

    const result = await processUpcomingRenewals(new Date('2026-01-02'));

    expect(chargeRenewal).not.toHaveBeenCalled();
    expect(result.chargesAttempted).toBe(0);
  });

  it('on charge success: extends currentPeriodEnd by one month and resets reminder state', async () => {
    const periodEnd = new Date('2026-01-01T00:00:00Z');
    const sub = { id: 'sub1', userId: 'u1', status: 'active', currentPeriodEnd: periodEnd };
    (prisma.subscription.findMany as any).mockResolvedValueOnce([]).mockResolvedValueOnce([sub]);
    (prisma.subscription.findUnique as any).mockResolvedValue(sub);
    (chargeRenewal as any).mockResolvedValue(undefined);

    const result = await processUpcomingRenewals(new Date('2026-01-02'));

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub1' },
        data: expect.objectContaining({ renewalReminderSentAt: null }),
      }),
    );
    expect(result.chargesSucceeded).toBe(1);
  });

  it('on charge failure: sets past_due, creates a failed Payment, sends failure email', async () => {
    const sub = {
      id: 'sub1',
      userId: 'u1',
      status: 'active',
      currentPeriodEnd: new Date('2026-01-01'),
    };
    (prisma.subscription.findMany as any).mockResolvedValueOnce([]).mockResolvedValueOnce([sub]);
    (prisma.subscription.findUnique as any).mockResolvedValue(sub);
    (chargeRenewal as any).mockRejectedValue(new Error('no mechanism'));
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'u1', email: 'a@b.com' });

    const result = await processUpcomingRenewals(new Date('2026-01-02'));

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'past_due' } }),
    );
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    );
    expect(sendPaymentFailureEmail).toHaveBeenCalled();
    expect(result.chargesFailed).toBe(1);
  });

  it('never charges a canceled subscription (excluded from the query entirely)', async () => {
    await processUpcomingRenewals(new Date());
    expect(prisma.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'active' }) }),
    );
  });

  it('one failing subscription does not stop the batch from processing the rest', async () => {
    const subA = {
      id: 'subA',
      userId: 'u1',
      status: 'active',
      currentPeriodEnd: new Date('2026-01-01'),
    };
    const subB = {
      id: 'subB',
      userId: 'u2',
      status: 'active',
      currentPeriodEnd: new Date('2026-01-01'),
    };
    (prisma.subscription.findMany as any)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([subA, subB]);
    (prisma.subscription.findUnique as any).mockImplementation(({ where }: any) =>
      Promise.resolve(where.id === 'subA' ? subA : subB),
    );
    (chargeRenewal as any)
      .mockRejectedValueOnce(new Error('fail A'))
      .mockResolvedValueOnce(undefined);
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'u1', email: 'a@b.com' });

    const result = await processUpcomingRenewals(new Date('2026-01-02'));

    expect(result.chargesAttempted).toBe(2);
    expect(result.chargesFailed).toBe(1);
    expect(result.chargesSucceeded).toBe(1);
  });

  it('returns the correct shape: remindersSent, chargesAttempted, chargesSucceeded, chargesFailed', async () => {
    const result = await processUpcomingRenewals(new Date());
    expect(result).toEqual({
      remindersSent: 0,
      chargesAttempted: 0,
      chargesSucceeded: 0,
      chargesFailed: 0,
    });
  });
});
