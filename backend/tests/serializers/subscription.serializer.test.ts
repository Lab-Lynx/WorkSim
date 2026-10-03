import { describe, it, expect } from 'vitest';
import { serializeSubscription } from '../../src/serializers/subscription.serializer.js';

describe('serializeSubscription', () => {
  it('returns only id, status, currentPeriodEnd, and canceledAt', () => {
    const dbRecord = {
      id: 'sub-uuid-123',
      userId: 'user-456',
      status: 'active',
      chapaSubscriptionRef: 'chapa-ref-789',
      currentPeriodEnd: new Date('2026-02-01T00:00:00Z'),
      canceledAt: null,
      renewalReminderSentAt: new Date('2026-01-25T00:00:00Z'),
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };

    const result = serializeSubscription(dbRecord);

    expect(result).toEqual({
      id: 'sub-uuid-123',
      status: 'active',
      currentPeriodEnd: new Date('2026-02-01T00:00:00Z'),
      canceledAt: null,
    });
  });

  it('never includes chapaSubscriptionRef', () => {
    const dbRecord = {
      id: 'sub-1',
      userId: 'u1',
      status: 'active',
      chapaSubscriptionRef: 'sensitive-chapa-ref',
      currentPeriodEnd: new Date(),
      canceledAt: null,
      renewalReminderSentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = serializeSubscription(dbRecord);
    expect(result).not.toHaveProperty('chapaSubscriptionRef');
    expect(JSON.stringify(result)).not.toContain('sensitive-chapa-ref');
  });

  it('never includes userId, createdAt, or updatedAt', () => {
    const dbRecord = {
      id: 'sub-1',
      userId: 'u1',
      status: 'active',
      chapaSubscriptionRef: null,
      currentPeriodEnd: new Date(),
      canceledAt: null,
      renewalReminderSentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = serializeSubscription(dbRecord);
    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('createdAt');
    expect(result).not.toHaveProperty('updatedAt');
  });

  it('returns exactly four keys, nothing extra', () => {
    const dbRecord = {
      id: 'sub-1',
      userId: 'u1',
      status: 'past_due',
      chapaSubscriptionRef: null,
      currentPeriodEnd: new Date(),
      canceledAt: null,
      renewalReminderSentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = serializeSubscription(dbRecord);
    expect(Object.keys(result).sort()).toEqual(['canceledAt', 'currentPeriodEnd', 'id', 'status']);
  });

  it('preserves a non-null canceledAt correctly', () => {
    const canceledAt = new Date('2026-01-15T00:00:00Z');
    const dbRecord = {
      id: 'sub-1',
      userId: 'u1',
      status: 'canceled',
      chapaSubscriptionRef: null,
      currentPeriodEnd: new Date(),
      canceledAt,
      renewalReminderSentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = serializeSubscription(dbRecord);
    expect(result.canceledAt).toBe(canceledAt);
  });
});
