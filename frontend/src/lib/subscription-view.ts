import type { SubscriptionStatusResponse } from '@/types';

export type SubscriptionViewKind =
  | 'never'
  | 'active'
  | 'renewal_pending'
  | 'past_due_access'
  | 'past_due_ended'
  | 'canceled_access'
  | 'ended'
  | 'unknown';

export type SubscriptionPrimaryAction = 'subscribe' | 'cancel';

export interface SubscriptionView {
  kind: SubscriptionViewKind;
  periodEnd: string | null;
  primaryAction: SubscriptionPrimaryAction | null;
  showsBanner: boolean;
}

/**
 * Turns subscription status plus access entitlement into a display view case.
 * Encodes the Doc 6 PG-07 case table and Q-15 resolution:
 * - 'subscribe' is offered only when hasAccess is false, and never for past_due.
 * - 'cancel' is offered only for active with hasAccess true.
 * - showsBanner is true only for past_due_access, past_due_ended, canceled_access, and ended.
 * - Returns kinds and dates only; no user-facing copy or price.
 */
export function getSubscriptionView(data: SubscriptionStatusResponse): SubscriptionView {
  if (!data || typeof data !== 'object') {
    return {
      kind: 'unknown',
      periodEnd: null,
      primaryAction: null,
      showsBanner: false,
    };
  }

  const { subscription, hasAccess } = data;

  if (typeof hasAccess !== 'boolean') {
    return {
      kind: 'unknown',
      periodEnd: null,
      primaryAction: null,
      showsBanner: false,
    };
  }

  const periodEnd = subscription?.currentPeriodEnd ?? null;

  if (!subscription) {
    if (!hasAccess) {
      return {
        kind: 'never',
        periodEnd: null,
        primaryAction: 'subscribe',
        showsBanner: false,
      };
    }

    return {
      kind: 'unknown',
      periodEnd: null,
      primaryAction: null,
      showsBanner: false,
    };
  }

  switch (subscription.status) {
    case 'active':
      if (hasAccess) {
        return {
          kind: 'active',
          periodEnd,
          primaryAction: 'cancel',
          showsBanner: false,
        };
      }
      return {
        kind: 'renewal_pending',
        periodEnd,
        primaryAction: null,
        showsBanner: false,
      };

    case 'past_due':
      if (hasAccess) {
        return {
          kind: 'past_due_access',
          periodEnd,
          primaryAction: null,
          showsBanner: true,
        };
      }
      return {
        kind: 'past_due_ended',
        periodEnd,
        primaryAction: null,
        showsBanner: true,
      };

    case 'canceled':
      if (hasAccess) {
        return {
          kind: 'canceled_access',
          periodEnd,
          primaryAction: null,
          showsBanner: true,
        };
      }
      return {
        kind: 'ended',
        periodEnd,
        primaryAction: 'subscribe',
        showsBanner: true,
      };

    default:
      return {
        kind: 'unknown',
        periodEnd,
        primaryAction: null,
        showsBanner: false,
      };
  }
}
