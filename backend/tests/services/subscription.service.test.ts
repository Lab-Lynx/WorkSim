import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTP_STATUS } from '../../src/constants/index.js';
import { SubscriptionStatus, PaymentStatus, Prisma } from '@prisma/client';

const subscriptionFindFirst = vi.fn();
const subscriptionUpdate = vi.fn();
const userFindUnique = vi.fn();
const ticketCount = vi.fn();
const paymentCreate = vi.fn();
const paymentFindMany = vi.fn();
const initializePayment = vi.fn();

vi.mock('../../src/config/db.js', () => ({
  prisma: {
    subscription: {
      findFirst: subscriptionFindFirst,
      update: subscriptionUpdate,
    },
    user: {
      findUnique: userFindUnique,
    },
    ticket: {
      count: ticketCount,
    },
    payment: {
      create: paymentCreate,
      findMany: paymentFindMany,
    },
  },
}));

const verifyTransaction = vi.fn();
const settleChapaPayment = vi.fn();

vi.mock('../../src/integrations/chapa.js', () => ({
  initializePayment,
  verifyTransaction,
}));

vi.mock('../../src/services/payment-settlement.service.js', () => ({
  settleChapaPayment,
}));

const {
  verifyPendingPayments,
  hasPaidAccess,
  getFreeTicketUsage,
  assertCanAssignTicket,
  createCheckout,
  getSubscriptionStatus,
  cancelSubscription,
  listPayments,
} = await import('../../src/services/subscription.service.js');

describe('subscription.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    paymentFindMany.mockResolvedValue([]);
  });

  describe('verifyPendingPayments', () => {
    const pendingPayment = { chapaTxRef: 'chapa-tx-1', amount: '450', currency: 'ETB' };

    it('settles a pending payment as succeeded when Chapa confirms the full amount', async () => {
      paymentFindMany.mockResolvedValue([pendingPayment]);
      verifyTransaction.mockResolvedValue({ status: 'success', amount: '450', currency: 'ETB' });

      await verifyPendingPayments('user-1');

      expect(settleChapaPayment).toHaveBeenCalledWith('chapa-tx-1', 'succeeded');
    });

    it('settles a pending payment as failed when Chapa reports failure', async () => {
      paymentFindMany.mockResolvedValue([pendingPayment]);
      verifyTransaction.mockResolvedValue({ status: 'failed' });

      await verifyPendingPayments('user-1');

      expect(settleChapaPayment).toHaveBeenCalledWith('chapa-tx-1', 'failed');
    });

    it('leaves the payment pending while Chapa still reports it as pending', async () => {
      paymentFindMany.mockResolvedValue([pendingPayment]);
      verifyTransaction.mockResolvedValue({ status: 'pending' });

      await verifyPendingPayments('user-1');

      expect(settleChapaPayment).not.toHaveBeenCalled();
    });

    it('does not grant access when the paid amount is lower than expected', async () => {
      paymentFindMany.mockResolvedValue([pendingPayment]);
      verifyTransaction.mockResolvedValue({ status: 'success', amount: '10', currency: 'ETB' });

      await verifyPendingPayments('user-1');

      expect(settleChapaPayment).not.toHaveBeenCalled();
    });

    it('keeps going and leaves the payment pending when Chapa verification errors', async () => {
      paymentFindMany.mockResolvedValue([pendingPayment, { ...pendingPayment, chapaTxRef: 'chapa-tx-2' }]);
      verifyTransaction
        .mockRejectedValueOnce(new Error('Chapa down'))
        .mockResolvedValueOnce({ status: 'success', amount: '450', currency: 'ETB' });

      await verifyPendingPayments('user-1');

      expect(settleChapaPayment).toHaveBeenCalledTimes(1);
      expect(settleChapaPayment).toHaveBeenCalledWith('chapa-tx-2', 'succeeded');
    });
  });

  describe('getSubscriptionStatus verification', () => {
    it('verifies pending payments before reporting status when the user has no access', async () => {
      subscriptionFindFirst.mockResolvedValue(null);
      ticketCount.mockResolvedValue(0);
      paymentFindMany.mockResolvedValue([{ chapaTxRef: 'chapa-tx-1', amount: '450', currency: 'ETB' }]);
      verifyTransaction.mockResolvedValue({ status: 'success', amount: '450', currency: 'ETB' });

      await getSubscriptionStatus('user-1');

      expect(verifyTransaction).toHaveBeenCalledWith('chapa-tx-1');
    });

    it('skips Chapa verification when the user already has paid access', async () => {
      subscriptionFindFirst.mockResolvedValue({
        id: 'sub-1',
        status: SubscriptionStatus.active,
        currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
        canceledAt: null,
      });
      ticketCount.mockResolvedValue(0);

      await getSubscriptionStatus('user-1');

      expect(paymentFindMany).not.toHaveBeenCalled();
      expect(verifyTransaction).not.toHaveBeenCalled();
    });
  });

  describe('hasPaidAccess', () => {
    it('returns true when a subscription has currentPeriodEnd in the future', async () => {
      subscriptionFindFirst.mockResolvedValue({ id: 'sub-1' });
      const now = new Date('2026-06-01T00:00:00.000Z');

      await expect(hasPaidAccess('user-1', now)).resolves.toBe(true);
      expect(subscriptionFindFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          currentPeriodEnd: { gt: now },
        },
        select: { id: true },
      });
    });

    it('returns false when no live subscription exists', async () => {
      subscriptionFindFirst.mockResolvedValue(null);
      await expect(hasPaidAccess('user-1')).resolves.toBe(false);
    });
  });

  describe('getFreeTicketUsage', () => {
    it.each([
      [0, 3],
      [2, 1],
      [3, 0],
      [5, 0],
    ])('with %i tickets used reports %i remaining', async (used, remaining) => {
      ticketCount.mockResolvedValue(used);

      await expect(getFreeTicketUsage('user-1')).resolves.toEqual({ limit: 3, used, remaining });
      expect(ticketCount).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    });
  });

  describe('assertCanAssignTicket', () => {
    it('allows subscribers without counting tickets', async () => {
      subscriptionFindFirst.mockResolvedValue({ id: 'sub-1' });

      await expect(assertCanAssignTicket('user-1')).resolves.toBeUndefined();
      expect(ticketCount).not.toHaveBeenCalled();
    });

    it('allows a non-subscriber who still has free tickets', async () => {
      subscriptionFindFirst.mockResolvedValue(null);
      ticketCount.mockResolvedValue(2);

      await expect(assertCanAssignTicket('user-1')).resolves.toBeUndefined();
    });

    it('throws 402 once a non-subscriber has used all 3 free tickets', async () => {
      subscriptionFindFirst.mockResolvedValue(null);
      ticketCount.mockResolvedValue(3);

      await expect(assertCanAssignTicket('user-1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.PAYMENT_REQUIRED,
        message: 'You have used your 3 free tickets. An active subscription is required to continue',
      });
    });
  });

  describe('createCheckout', () => {
    it('throws 409 if user already has an active subscription', async () => {
      subscriptionFindFirst.mockResolvedValue({ id: 'sub-1' });

      await expect(createCheckout('user-1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.CONFLICT,
        message: 'You already have an active subscription',
      });
    });

    it('throws 404 if user not found', async () => {
      subscriptionFindFirst.mockResolvedValue(null);
      userFindUnique.mockResolvedValue(null);

      await expect(createCheckout('user-1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'User not found',
      });
    });

    it('creates pending payment and calls initializePayment', async () => {
      subscriptionFindFirst.mockResolvedValue(null);
      userFindUnique.mockResolvedValue({ email: 'ada@example.com', name: 'Ada Lovelace' });
      paymentCreate.mockResolvedValue({ id: 'pay-1' });
      initializePayment.mockResolvedValue({ checkoutUrl: 'https://checkout.chapa.co/test' });

      const result = await createCheckout('user-1');

      expect(paymentCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            status: PaymentStatus.pending,
          }),
        }),
      );
      expect(initializePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
          callbackUrl: expect.stringMatching(/^https?:\/\/[^/]+\/api\/v1\/webhooks\/chapa$/),
        }),
      );
      expect(result).toEqual({ checkoutUrl: 'https://checkout.chapa.co/test' });
    });
  });

  describe('getSubscriptionStatus', () => {
    it('returns null subscription and hasAccess: false when no subscription exists', async () => {
      subscriptionFindFirst.mockResolvedValue(null);
      ticketCount.mockResolvedValue(1);

      const result = await getSubscriptionStatus('user-1');
      expect(result).toEqual({
        subscription: null,
        hasAccess: false,
        freeTickets: { limit: 3, used: 1, remaining: 2 },
      });
    });

    it('returns serialized subscription and hasAccess when subscription exists', async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);
      subscriptionFindFirst.mockResolvedValue({
        id: 'sub-1',
        status: SubscriptionStatus.active,
        currentPeriodEnd: future,
        canceledAt: null,
      });
      ticketCount.mockResolvedValue(4);

      const result = await getSubscriptionStatus('user-1');
      expect(result).toEqual({
        subscription: {
          id: 'sub-1',
          status: SubscriptionStatus.active,
          currentPeriodEnd: future.toISOString(),
          canceledAt: null,
        },
        hasAccess: true,
        freeTickets: { limit: 3, used: 4, remaining: 0 },
      });
    });
  });

  describe('cancelSubscription', () => {
    it('throws 404 if no active subscription exists', async () => {
      subscriptionFindFirst.mockResolvedValue(null);

      await expect(cancelSubscription('user-1')).rejects.toMatchObject({
        statusCode: HTTP_STATUS.NOT_FOUND,
        message: 'No active subscription found to cancel',
      });
    });

    it('updates subscription to canceled and returns serialized subscription', async () => {
      const canceledAt = new Date();
      const currentPeriodEnd = new Date(Date.now() + 10000);
      subscriptionFindFirst.mockResolvedValue({
        id: 'sub-1',
        status: SubscriptionStatus.active,
      });
      subscriptionUpdate.mockResolvedValue({
        id: 'sub-1',
        status: SubscriptionStatus.canceled,
        currentPeriodEnd,
        canceledAt,
      });

      const result = await cancelSubscription('user-1');

      expect(subscriptionUpdate).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: expect.objectContaining({
          status: SubscriptionStatus.canceled,
        }),
      });
      expect(result).toEqual({
        id: 'sub-1',
        status: SubscriptionStatus.canceled,
        currentPeriodEnd: currentPeriodEnd.toISOString(),
        canceledAt: canceledAt.toISOString(),
      });
    });
  });

  describe('listPayments', () => {
    it('returns serialized list of payments', async () => {
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      const paidAt = new Date('2026-01-01T00:05:00.000Z');
      paymentFindMany.mockResolvedValue([
        {
          id: 'pay-1',
          amount: new Prisma.Decimal('29.00'),
          currency: 'ETB',
          status: PaymentStatus.succeeded,
          paidAt,
          createdAt,
        },
      ]);

      const result = await listPayments('user-1');

      expect(result).toEqual([
        {
          id: 'pay-1',
          amount: '29',
          currency: 'ETB',
          status: PaymentStatus.succeeded,
          paidAt: paidAt.toISOString(),
          createdAt: createdAt.toISOString(),
        },
      ]);
    });
  });
});
