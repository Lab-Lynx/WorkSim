import type { SubscriptionStatus } from '@prisma/client';

export type SerializedSubscription = {
  id: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string;
  canceledAt: string | null;
};

export type SerializeSubscriptionInput = {
  id: string;
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
  canceledAt: Date | null;
};

export const serializeSubscription = (
  sub: SerializeSubscriptionInput,
): SerializedSubscription => ({
  id: sub.id,
  status: sub.status,
  currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
  canceledAt: sub.canceledAt ? sub.canceledAt.toISOString() : null,
});
