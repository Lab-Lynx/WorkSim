import { describe, expect, it } from 'vitest';
import { getSubscriptionView } from '@/lib/subscription-view';
import type { SubscriptionStatus, SubscriptionStatusResponse } from '@/types';

describe('subscription-view helper', () => {
  const periodEnd = '2026-10-19T14:05:00.000Z';

  function createResponse(
    status: SubscriptionStatus | 'unknown_status' | null,
    hasAccess: boolean,
    customPeriodEnd: string = periodEnd
  ): SubscriptionStatusResponse {
    if (status === null) {
      return {
        subscription: null,
        hasAccess,
      };
    }

    return {
      subscription: {
        id: '11111111-1111-4111-8111-111111111111',
        status: status as SubscriptionStatus,
        currentPeriodEnd: customPeriodEnd,
        canceledAt: status === 'canceled' ? '2026-09-19T14:05:00.000Z' : null,
      },
      hasAccess,
    };
  }

  describe('documented state table (Doc 10 §10.5 / Doc 6 PG-07)', () => {
    it('handles never (null subscription, hasAccess: false)', () => {
      const result = getSubscriptionView(createResponse(null, false));

      expect(result).toEqual({
        kind: 'never',
        periodEnd: null,
        primaryAction: 'subscribe',
        showsBanner: false,
      });
    });

    it('handles active (active subscription, hasAccess: true)', () => {
      const result = getSubscriptionView(createResponse('active', true));

      expect(result).toEqual({
        kind: 'active',
        periodEnd,
        primaryAction: 'cancel',
        showsBanner: false,
      });
    });

    it('handles renewal_pending (active subscription, hasAccess: false)', () => {
      const result = getSubscriptionView(createResponse('active', false));

      expect(result).toEqual({
        kind: 'renewal_pending',
        periodEnd,
        primaryAction: null,
        showsBanner: false,
      });
    });

    it('handles past_due_access (past_due subscription, hasAccess: true)', () => {
      const result = getSubscriptionView(createResponse('past_due', true));

      expect(result).toEqual({
        kind: 'past_due_access',
        periodEnd,
        primaryAction: null,
        showsBanner: true,
      });
    });

    it('handles past_due_ended (past_due subscription, hasAccess: false)', () => {
      const result = getSubscriptionView(createResponse('past_due', false));

      expect(result).toEqual({
        kind: 'past_due_ended',
        periodEnd,
        primaryAction: null,
        showsBanner: true,
      });
    });

    it('handles canceled_access (canceled subscription, hasAccess: true)', () => {
      const result = getSubscriptionView(createResponse('canceled', true));

      expect(result).toEqual({
        kind: 'canceled_access',
        periodEnd,
        primaryAction: null,
        showsBanner: true,
      });
    });

    it('handles ended (canceled subscription, hasAccess: false)', () => {
      const result = getSubscriptionView(createResponse('canceled', false));

      expect(result).toEqual({
        kind: 'ended',
        periodEnd,
        primaryAction: 'subscribe',
        showsBanner: true,
      });
    });
  });

  describe('Q-15 and primaryAction constraints', () => {
    it('never offers subscribe action for past_due even when hasAccess is false (Q-15)', () => {
      const pastDueAccess = getSubscriptionView(createResponse('past_due', true));
      const pastDueEnded = getSubscriptionView(createResponse('past_due', false));

      expect(pastDueAccess.primaryAction).toBeNull();
      expect(pastDueEnded.primaryAction).toBeNull();
    });

    it('offers subscribe action only when hasAccess is false (never and ended)', () => {
      const states: Array<{ status: SubscriptionStatus | null; hasAccess: boolean }> = [
        { status: null, hasAccess: false },
        { status: 'active', hasAccess: true },
        { status: 'active', hasAccess: false },
        { status: 'past_due', hasAccess: true },
        { status: 'past_due', hasAccess: false },
        { status: 'canceled', hasAccess: true },
        { status: 'canceled', hasAccess: false },
      ];

      for (const state of states) {
        const view = getSubscriptionView(createResponse(state.status, state.hasAccess));
        if (view.primaryAction === 'subscribe') {
          expect(state.hasAccess).toBe(false);
          expect(state.status === null || state.status === 'canceled').toBe(true);
        }
      }
    });

    it('offers cancel action only for active with hasAccess true', () => {
      const active = getSubscriptionView(createResponse('active', true));
      expect(active.primaryAction).toBe('cancel');

      const canceledAccess = getSubscriptionView(createResponse('canceled', true));
      expect(canceledAccess.primaryAction).toBeNull();
    });
  });

  describe('showsBanner rules', () => {
    it('shows banner only for past_due_access, past_due_ended, canceled_access, and ended', () => {
      expect(getSubscriptionView(createResponse('past_due', true)).showsBanner).toBe(true);
      expect(getSubscriptionView(createResponse('past_due', false)).showsBanner).toBe(true);
      expect(getSubscriptionView(createResponse('canceled', true)).showsBanner).toBe(true);
      expect(getSubscriptionView(createResponse('canceled', false)).showsBanner).toBe(true);

      expect(getSubscriptionView(createResponse(null, false)).showsBanner).toBe(false);
      expect(getSubscriptionView(createResponse('active', true)).showsBanner).toBe(false);
      expect(getSubscriptionView(createResponse('active', false)).showsBanner).toBe(false);
    });
  });

  describe('edge cases and unexpected input', () => {
    it('returns unknown with no action and no banner for unexpected status string', () => {
      const result = getSubscriptionView(createResponse('unknown_status', false));

      expect(result).toEqual({
        kind: 'unknown',
        periodEnd,
        primaryAction: null,
        showsBanner: false,
      });
    });

    it('returns unknown when subscription is null but hasAccess is unexpectedly true', () => {
      const result = getSubscriptionView(createResponse(null, true));

      expect(result).toEqual({
        kind: 'unknown',
        periodEnd: null,
        primaryAction: null,
        showsBanner: false,
      });
    });

    it('handles malformed or missing data defensively', () => {
      // @ts-expect-error testing defensive handling
      expect(getSubscriptionView(null)).toEqual({
        kind: 'unknown',
        periodEnd: null,
        primaryAction: null,
        showsBanner: false,
      });

      // @ts-expect-error testing defensive handling
      expect(getSubscriptionView(undefined)).toEqual({
        kind: 'unknown',
        periodEnd: null,
        primaryAction: null,
        showsBanner: false,
      });

      // @ts-expect-error testing defensive handling
      expect(getSubscriptionView({})).toEqual({
        kind: 'unknown',
        periodEnd: null,
        primaryAction: null,
        showsBanner: false,
      });
    });
  });

  describe('pure helper contract', () => {
    it('returns only kinds, periodEnd, primaryAction, and showsBanner without user-facing copy or price', () => {
      const result = getSubscriptionView(createResponse('active', true));

      const keys = Object.keys(result).sort();
      expect(keys).toEqual(['kind', 'periodEnd', 'primaryAction', 'showsBanner']);
      expect(result).not.toHaveProperty('price');
      expect(result).not.toHaveProperty('currency');
      expect(result).not.toHaveProperty('label');
      expect(result).not.toHaveProperty('message');
    });
  });
});
