import { randomBytes } from 'node:crypto';
import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { HTTP_STATUS } from '../constants/index.js';
import ApiError from '../utils/ApiError.js';
import { PaymentStatus, SubscriptionStatus } from '@prisma/client';
import * as chapaIntegration from '../integrations/chapa.js';
import {
  serializeSubscription,
  type SerializedSubscription,
} from '../serializers/subscription.serializer.js';
import {
  serializePayment,
  type SerializedPayment,
} from '../serializers/payment.serializer.js';

/**
 * Shared subscription gate (Doc 8 / FR-15).
 * Access when any subscription has currentPeriodEnd in the future, regardless of status.
 */
export const hasPaidAccess = async (userId: string, now: Date = new Date()): Promise<boolean> => {
  const live = await prisma.subscription.findFirst({
    where: {
      userId,
      currentPeriodEnd: { gt: now },
    },
    select: { id: true },
  });
  return live !== null;
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
): Promise<{ subscription: SerializedSubscription | null; hasAccess: boolean }> => {
  const subscription = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  const hasAccess = await hasPaidAccess(userId);

  return {
    subscription: subscription ? serializeSubscription(subscription) : null,
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
      status: SubscriptionStatus.active,
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

  return serializeSubscription(updated);
};

/**
 * List payment history for a user (EP-17).
 */
export const listPayments = async (userId: string): Promise<SerializedPayment[]> => {
  const payments = await prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return payments.map(serializePayment);
};
