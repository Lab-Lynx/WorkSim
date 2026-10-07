import { PaymentStatus, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../config/db.js';

export type PaymentOutcome = 'succeeded' | 'failed';

/**
 * Apply a final Chapa result to a pending payment. Shared by the webhook and the
 * verify-on-return fallback; only a payment that is still pending is ever changed,
 * so running both paths for the same transaction is safe.
 */
export const settleChapaPayment = async (
  txRef: string,
  outcome: PaymentOutcome,
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { chapaTxRef: txRef } });
    if (!payment || payment.status !== PaymentStatus.pending) return;

    if (outcome === 'succeeded') {
      const paidAt = new Date();
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.succeeded, paidAt },
      });
      const current = await tx.subscription.findFirst({
        where: { userId: payment.userId, currentPeriodEnd: { gt: paidAt } },
      });
      if (!current) {
        const currentPeriodEnd = new Date(paidAt);
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
        await tx.subscription.create({
          data: {
            userId: payment.userId,
            status: SubscriptionStatus.active,
            currentPeriodEnd,
            payments: { connect: { id: payment.id } },
          },
        });
      }
    } else {
      await tx.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.failed } });
      await tx.subscription.updateMany({
        where: { userId: payment.userId, status: SubscriptionStatus.active },
        data: { status: SubscriptionStatus.past_due },
      });
    }
  });
};
