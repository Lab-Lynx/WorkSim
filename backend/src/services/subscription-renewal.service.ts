import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { chargeRenewal } from '../integrations/chapa';
import { sendRenewalReminderEmail, sendPaymentFailureEmail } from './email.service';

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

function startAndEndOfDay(date: Date): [Date, Date] {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return [start, end];
}

export interface RenewalRunResult {
  remindersSent: number;
  chargesAttempted: number;
  chargesSucceeded: number;
  chargesFailed: number;
}

export async function processUpcomingRenewals(now: Date = new Date()): Promise<RenewalRunResult> {
  const result: RenewalRunResult = {
    remindersSent: 0,
    chargesAttempted: 0,
    chargesSucceeded: 0,
    chargesFailed: 0,
  };

  // --- Reminders: exactly 7 calendar days from currentPeriodEnd ---
  const sevenDaysOut = new Date(now);
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
  const [dayStart, dayEnd] = startAndEndOfDay(sevenDaysOut);

  const dueForReminder = await prisma.subscription.findMany({
    where: {
      status: 'active',
      currentPeriodEnd: { gte: dayStart, lte: dayEnd },
      renewalReminderSentAt: null,
    },
    include: { user: true },
  });

  for (const sub of dueForReminder) {
    // Conditional guard: only the run that actually flips null → now proceeds,
    // making a duplicate/concurrent run for the same day a safe no-op.
    const guarded = await prisma.subscription.updateMany({
      where: { id: sub.id, renewalReminderSentAt: null },
      data: { renewalReminderSentAt: now },
    });
    if (guarded.count === 0) continue;

    try {
      await sendRenewalReminderEmail(sub.user.email, sub.currentPeriodEnd);
      result.remindersSent += 1;
    } catch {
      // A failed reminder email shouldn't block reminders for other users.
    }
  }

  // --- Charges: period has actually ended ---
  const dueForCharge = await prisma.subscription.findMany({
    where: { status: 'active', currentPeriodEnd: { lte: now } },
  });

  for (const sub of dueForCharge) {
    // Re-verify immediately before charging — it may have been canceled
    // between the query above and this point in the loop.
    const fresh = await prisma.subscription.findUnique({ where: { id: sub.id } });
    if (!fresh || fresh.status !== 'active') continue;

    result.chargesAttempted += 1;
    const txRef = `renewal-${sub.id}-${crypto.randomUUID()}`;

    try {
      // chargeRenewal always throws today — see the callout in this ticket's
      // response. Every attempt currently fails honestly rather than faking
      // a successful renewal.
      await chargeRenewal({ subscriptionId: sub.id, txRef });

      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          currentPeriodEnd: addOneMonth(fresh.currentPeriodEnd),
          renewalReminderSentAt: null,
        },
      });
      result.chargesSucceeded += 1;
    } catch {
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'past_due' } });
      await prisma.payment.create({
        data: {
          userId: sub.userId,
          subscriptionId: sub.id,
          chapaTxRef: txRef,
          amount: requireEnv('SUBSCRIPTION_PRICE_AMOUNT'),
          currency: requireEnv('SUBSCRIPTION_PRICE_CURRENCY'),
          status: 'failed',
        },
      });

      const user = await prisma.user.findUnique({ where: { id: sub.userId } });
      if (user) {
        await sendPaymentFailureEmail(user.email, fresh.currentPeriodEnd).catch(() => {});
      }
      result.chargesFailed += 1;
    }
  }

  return result;
}
