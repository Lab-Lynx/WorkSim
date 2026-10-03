import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { ApiError } from '../lib/errors/ApiError';
import { logger } from '../lib/logger';
import { initializeCheckout, cancelChapaSubscription } from '../integrations/chapa';
import { sendPaymentFailureEmail } from './email.service';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function addOneMonth(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d;
}

// ---- hasPaidAccess: used directly by the paid-access middleware ----
export async function hasPaidAccess(userId: string, now: Date = new Date()): Promise<boolean> {
  const count = await prisma.subscription.count({
    where: { userId, currentPeriodEnd: { gt: now } }, // strict > : exactly-at-end is false
  });
  return count > 0;
}

// ---- EP-13 ----
export async function createCheckout(userId: string): Promise<{ checkoutUrl: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, 'User not found');

  if (!user.emailVerifiedAt) {
    throw new ApiError(403, 'Verify your email before subscribing'); // D-01
  }

  const existing = await prisma.subscription.findFirst({
    where: { userId, status: { in: ['active', 'past_due'] } },
  });
  if (existing) {
    throw new ApiError(409, 'You already have an active subscription');
  }

  // Amount/currency come ONLY from server config — createCheckout takes no
  // amount parameter at all, so a caller structurally cannot pass one in.
  const amount = requireEnv('SUBSCRIPTION_PRICE_AMOUNT');
  const currency = requireEnv('SUBSCRIPTION_PRICE_CURRENCY');
  const txRef = `sub-${userId}-${crypto.randomUUID()}`;

  await prisma.payment.create({
    data: { userId, chapaTxRef: txRef, amount, currency, status: 'pending' },
  });

  try {
    const { checkoutUrl } = await initializeCheckout({
      amount,
      currency,
      email: user.email,
      txRef,
      callbackUrl: requireEnv('CHAPA_WEBHOOK_CALLBACK_URL'),
      returnUrl: requireEnv('CHAPA_CHECKOUT_RETURN_URL'),
    });
    return { checkoutUrl };
  } catch {
    // The Payment row stays 'pending' — harmless, and lets the user retry
    // without hitting any uniqueness conflict (a fresh txRef next attempt).
    throw new ApiError(502, 'Could not start checkout with Chapa, please try again');
  }
}

// ---- EP-14 (webhook) ----
interface ChapaWebhookPayload {
  tx_ref: string;
  status: string; // 'success' | 'failed' per Chapa's event payload
}

export async function processChapaWebhook(payload: ChapaWebhookPayload): Promise<void> {
  const payment = await prisma.payment.findUnique({ where: { chapaTxRef: payload.tx_ref } });

  if (!payment) {
    logger.warn({ txRef: payload.tx_ref }, 'chapa webhook: unknown transaction reference');
    return;
  }

  if (payment.status !== 'pending') {
    return; // already terminal — duplicate delivery, no-op (DR-06)
  }

  const succeeded = payload.status === 'success';

  // Conditional guard, same idempotency pattern as the GitHub webhook:
  // only the delivery that actually flips 'pending' proceeds further.
  const guarded = await prisma.payment.updateMany({
    where: { id: payment.id, status: 'pending' },
    data: {
      status: succeeded ? 'succeeded' : 'failed',
      paidAt: succeeded ? new Date() : undefined,
    },
  });
  if (guarded.count === 0) return;

  if (succeeded) {
    const currentPeriodEnd = addOneMonth(new Date());
    const existing = await prisma.subscription.findFirst({
      where: { userId: payment.userId },
      orderBy: { createdAt: 'desc' },
    });

    const subscription =
      !existing || existing.status === 'canceled'
        ? await prisma.subscription.create({
            data: { userId: payment.userId, status: 'active', currentPeriodEnd },
          })
        : await prisma.subscription.update({
            where: { id: existing.id },
            data: { status: 'active', currentPeriodEnd },
          });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { subscriptionId: subscription.id },
    });
  } else {
    const subscription = await prisma.subscription.findFirst({
      where: { userId: payment.userId },
      orderBy: { createdAt: 'desc' },
    });

    if (subscription) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'past_due' },
      });
    }

    const user = await prisma.user.findUnique({ where: { id: payment.userId } });
    if (user) {
      // Email failure must not undo the payment/subscription state already
      // written above — the .catch() here is deliberate, not an oversight.
      await sendPaymentFailureEmail(user.email, subscription?.currentPeriodEnd ?? new Date()).catch(
        () => {},
      );
    }
  }
}

// ---- EP-15 ----
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

// ---- EP-16 ----
export async function cancelSubscription(userId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: { in: ['active', 'past_due'] } },
  });
  if (!subscription) throw new ApiError(409, 'No active subscription to cancel');

  try {
    // NOTE: cancelChapaSubscription always throws today (Q-05 unresolved) —
    // see the callout above this file. This means cancellation currently
    // always 502s. That is a known, deliberate consequence, not a bug here.
    await cancelChapaSubscription(subscription.chapaSubscriptionRef ?? '');
  } catch {
    throw new ApiError(502, 'Could not cancel with Chapa, please try again');
  }

  return prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: 'canceled', canceledAt: new Date() },
  });
}

// ---- EP-17 ----
export async function listPayments(userId: string) {
  return prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, amount: true, currency: true, status: true, paidAt: true, createdAt: true },
    // chapaTxRef, userId, subscriptionId, updatedAt deliberately excluded —
    // this `select` is the same defense-in-depth idea as your repo serializer.
  });
}
