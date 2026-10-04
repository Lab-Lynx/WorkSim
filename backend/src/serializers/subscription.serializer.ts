export interface SubscriptionDbRecord {
  id: string;
  status: string;
  currentPeriodEnd: Date | string;
  canceledAt: Date | string | null;
  [key: string]: unknown;
}

export interface SerializedSubscription {
  id: string;
  status: string;
  currentPeriodEnd: Date | string;
  canceledAt: Date | string | null;
}

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
