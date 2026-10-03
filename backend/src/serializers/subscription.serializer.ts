export interface SubscriptionDbRecord {
  id: string;
  status: string;
  currentPeriodEnd: Date;
  canceledAt: Date | null;
  [key: string]: unknown; // tolerates chapaSubscriptionRef, renewalReminderSentAt, etc.
}

export interface SerializedSubscription {
  id: string;
  status: string;
  currentPeriodEnd: Date;
  canceledAt: Date | null;
}

export function serializeSubscription(subscription: SubscriptionDbRecord): SerializedSubscription {
  return {
    id: subscription.id,
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
    canceledAt: subscription.canceledAt,
  };
}
