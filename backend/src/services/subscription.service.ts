import crypto from 'crypto';
import { prisma } from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import { SubscriptionStatus, PaymentStatus } from '@prisma/client';
import { initializeCheckout, cancelChapaSubscription } from '../integrations/chapa.js';

/**
 * Shared subscription gate (Doc 8 / FR-15).
 * Access when any subscription has currentPeriodEnd in the future, regardless of status.
 */
export const hasPaidAccess = async (
  userId: string,
  now: Date = new Date(),
): Promise<boolean> => {
  const live = await prisma.subscription.findFirst({
    where: {
      userId,
      currentPeriodEnd: { gt: now },
    },
    select: { id: true },
  });
  return live !== null;
};

// ---- EP-13: create checkout ----
export async function createCheckout(userId: string): Promise<{ checkoutUrl: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
  }

  if (!user.emailVerifiedAt) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Verify your email before subscribing');
  }

  const existing = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: [SubscriptionStatus.active, SubscriptionStatus.past_due] },
    },
  });
  if (existing) {
    throw new ApiError(HTTP_STATUS.CONFLICT, 'You already have an active subscription');
  }

  const amount = process.env.CHAPA_PRICE || process.env.SUBSCRIPTION_PRICE_AMOUNT || '450';
  const currency = process.env.CHAPA_CURRENCY || process.env.SUBSCRIPTION_PRICE_CURRENCY || 'ETB';
  const txRef = `sub-${userId}-${crypto.randomUUID()}`;

  await prisma.payment.create({
    data: {
      userId,
      chapaTxRef: txRef,
      amount,
      currency,
      status: PaymentStatus.pending,
    },
  });

  try {
    const returnUrl =
      process.env.CHAPA_RETURN_URL ||
      `${process.env.CLIENT_URL || 'http://localhost:5173'}/billing/return`;
    const callbackUrl =
      process.env.CHAPA_WEBHOOK_CALLBACK_URL ||
      `${process.env.CLIENT_URL || 'http://localhost:3000'}/api/v1/webhooks/chapa`;

    const { checkoutUrl } = await initializeCheckout({
      amount: String(amount),
      currency: String(currency),
      email: user.email,
      txRef,
      callbackUrl,
      returnUrl,
    });
    return { checkoutUrl };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      HTTP_STATUS.BAD_GATEWAY,
      'Could not start checkout with Chapa, please try again',
    );
  }
}

// ---- EP-15: get status ----
export async function getSubscriptionStatus(
  userId: string,
): Promise<{ subscription: unknown; hasAccess: boolean }> {
  const subscription = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  const hasAccess = await hasPaidAccess(userId);
  return { subscription, hasAccess };
}

// ---- EP-16: cancel ----
export async function cancelSubscription(userId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: [SubscriptionStatus.active, SubscriptionStatus.past_due] },
    },
  });
  if (!subscription) {
    throw new ApiError(HTTP_STATUS.CONFLICT, 'No active subscription to cancel');
  }

  if (subscription.chapaSubscriptionRef) {
    try {
      await cancelChapaSubscription(subscription.chapaSubscriptionRef);
    } catch {
      throw new ApiError(
        HTTP_STATUS.BAD_GATEWAY,
        'Could not cancel with Chapa, please try again',
      );
    }
  }

  return prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: SubscriptionStatus.canceled,
      canceledAt: new Date(),
    },
  });
}

// ---- EP-17: list payments ----
export async function listPayments(userId: string) {
  return prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      paidAt: true,
      createdAt: true,
    },
  });
}
