import { describe, it, expect } from 'vitest';
import { serializePayment } from '../../src/serializers/payment.serializer.js';

describe('serializePayment', () => {
  it('returns only id, amount, currency, status, paidAt, and createdAt', () => {
    const dbRecord = {
      id: 'pay-uuid-123',
      userId: 'user-456',
      subscriptionId: 'sub-789',
      chapaTxRef: 'chapa-tx-ref-123',
      amount: '450.00',
      currency: 'ETB',
      status: 'succeeded',
      paidAt: new Date('2026-02-01T00:00:00Z'),
      createdAt: new Date('2026-02-01T00:00:00Z'),
      updatedAt: new Date('2026-02-01T00:00:00Z'),
    };

    const result = serializePayment(dbRecord);

    expect(result).toEqual({
      id: 'pay-uuid-123',
      amount: '450.00',
      currency: 'ETB',
      status: 'succeeded',
      paidAt: new Date('2026-02-01T00:00:00Z'),
      createdAt: new Date('2026-02-01T00:00:00Z'),
    });
  });

  it('never includes chapaTxRef', () => {
    const dbRecord = {
      id: 'pay-1',
      userId: 'u1',
      chapaTxRef: 'sensitive-chapa-tx-ref',
      amount: '450.00',
      currency: 'ETB',
      status: 'pending',
      paidAt: null,
      createdAt: new Date(),
    };

    const result = serializePayment(dbRecord);
    expect(result).not.toHaveProperty('chapaTxRef');
    expect(JSON.stringify(result)).not.toContain('sensitive-chapa-tx-ref');
  });

  it('never includes userId or subscriptionId', () => {
    const dbRecord = {
      id: 'pay-1',
      userId: 'u1',
      subscriptionId: 'sub-1',
      amount: '450.00',
      currency: 'ETB',
      status: 'succeeded',
      paidAt: new Date(),
      createdAt: new Date(),
    };

    const result = serializePayment(dbRecord);
    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('subscriptionId');
  });
});
