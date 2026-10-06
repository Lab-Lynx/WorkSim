import { randomBytes } from 'node:crypto';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { FREE_TICKET_LIMIT, HTTP_STATUS } from '../constants/index.js';
import ApiError from '../utils/ApiError.js';
import { PaymentStatus, SubscriptionStatus } from '@prisma/client';
import * as chapaIntegration from '../integrations/chapa.js';
import type { SerializedSubscription } from '../serializers/subscription.serializer.js';
import type { SerializedPayment } from '../serializers/payment.serializer.js';

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

export interface FreeTicketUsage {
  limit: number;
  used: number;
  remaining: number;
}

/**
 * Free-trial usage: every ticket ever assigned counts, including abandoned ones,
 * so abandoning cannot be used to get unlimited free tickets.
 */
export const getFreeTicketUsage = async (userId: string): Promise<FreeTicketUsage> => {
  const used = await prisma.ticket.count({ where: { userId } });
  return {
    limit: FREE_TICKET_LIMIT,
    used,
    remaining: Math.max(FREE_TICKET_LIMIT - used, 0),
  };
};

/**
 * Ticket gate: subscribers are unlimited, everyone else gets FREE_TICKET_LIMIT tickets.
 */
export const assertCanAssignTicket = async (userId: string): Promise<void> => {
  if (await hasPaidAccess(userId)) return;

  const usage = await getFreeTicketUsage(userId);
  if (usage.remaining === 0) {
    throw new ApiError(
      HTTP_STATUS.PAYMENT_REQUIRED,
      `You have used your ${usage.limit} free tickets. An active subscription is required to continue`,
    );
  }
};

/**
 * Start checkout session for subscription (EP-13 / FR-17).
 */
export const createCheckout = async (userId: string): Promise<{ checkoutUrl: string }> => {
  if (await hasPaidAccess(userId)) {
    throw new ApiError(HTTP_STATUS.CONFLICT, 'You already have an active subscription');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (!user) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
  }

  const amount = env.CHAPA_PRICE ?? 29;
  const currency = env.CHAPA_CURRENCY ?? 'ETB';
  const txRef = `chapa-${userId.slice(0, 8)}-${Date.now()}-${randomBytes(4).toString('hex')}`;

  await prisma.payment.create({
    data: {
      userId,
      chapaTxRef: txRef,
      amount,
      currency,
      status: PaymentStatus.pending,
    },
  });

  const nameParts = (user.name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || 'Customer';
  const lastName = nameParts.slice(1).join(' ') || undefined;

  const callbackUrl = `${env.CLIENT_URL.replace(/\/+$/, '')}/api/v1/webhooks/chapa`;
  const returnUrl = env.CHAPA_RETURN_URL;

  const { checkoutUrl } = await chapaIntegration.initializePayment({
    amount,
    currency,
    email: user.email,
    firstName,
    lastName,
    txRef,
    callbackUrl,
    returnUrl,
  });

  return { checkoutUrl };
};

/**
 * Get current subscription status and access flag (EP-15).
 */
export const getSubscriptionStatus = async (
  userId: string,
): Promise<{
  subscription: SerializedSubscription | null;
  hasAccess: boolean;
  freeTickets: FreeTicketUsage;
}> => {
  const subscription = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  const hasAccess = await hasPaidAccess(userId);
  const freeTickets = await getFreeTicketUsage(userId);

  return {
    freeTickets,
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          currentPeriodEnd:
            subscription.currentPeriodEnd instanceof Date
              ? subscription.currentPeriodEnd.toISOString()
              : String(subscription.currentPeriodEnd),
          canceledAt:
            subscription.canceledAt instanceof Date
              ? subscription.canceledAt.toISOString()
              : (subscription.canceledAt ?? null),
        }
      : null,
    hasAccess,
  };
};

/**
 * Cancel an active subscription (EP-16).
 */
export const cancelSubscription = async (userId: string): Promise<SerializedSubscription> => {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: [SubscriptionStatus.active, SubscriptionStatus.past_due] },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!subscription) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'No active subscription found to cancel');
  }

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: SubscriptionStatus.canceled,
      canceledAt: new Date(),
    },
  });

  return {
    id: updated.id,
    status: updated.status,
    currentPeriodEnd:
      updated.currentPeriodEnd instanceof Date
        ? updated.currentPeriodEnd.toISOString()
        : String(updated.currentPeriodEnd),
    canceledAt:
      updated.canceledAt instanceof Date
        ? updated.canceledAt.toISOString()
        : (updated.canceledAt ?? null),
  };
};

/**
 * List payment history for a user (EP-17).
 */
export const listPayments = async (userId: string): Promise<SerializedPayment[]> => {
  const payments = await prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return payments.map((p) => ({
    id: p.id,
    amount:
      typeof p.amount === 'object' && p.amount !== null && 'toString' in p.amount
        ? (p.amount as { toString(): string }).toString()
        : String(p.amount ?? '0.00'),
    currency: p.currency,
    status: p.status,
    paidAt: p.paidAt instanceof Date ? p.paidAt.toISOString() : (p.paidAt ?? null),
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
  }));
};
