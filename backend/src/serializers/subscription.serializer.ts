import type { SubscriptionStatus } from '@prisma/client';

export interface SubscriptionDbRecord {
  id: string;
  status: SubscriptionStatus | string;
  currentPeriodEnd: Date | string;
  canceledAt: Date | string | null;
  [key: string]: unknown;
}

export interface SerializedSubscription {
  id: string;
  status: SubscriptionStatus | string;
  currentPeriodEnd: Date | string;
  canceledAt: Date | string | null;
}

export type SerializeSubscriptionInput = SubscriptionDbRecord;

export function serializeSubscription(
  subscription: SubscriptionDbRecord,
): SerializedSubscription {
  return {
    id: subscription.id,
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
    canceledAt: subscription.canceledAt,
  };
}
