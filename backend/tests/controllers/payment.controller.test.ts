import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/subscription.service', () => ({
  listPayments: vi.fn(),
}));

vi.mock('../../src/serializers/payment.serializer', () => ({
  serializePayment: vi.fn((p: any) => ({
    id: p.id,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    paidAt: p.paidAt,
    createdAt: p.createdAt,
  })),
}));

import { listPayments } from '../../src/services/subscription.service';
import { serializePayment } from '../../src/serializers/payment.serializer';
import { getPayments } from '../../src/controllers/payment.controller';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getPayments', () => {
  it('returns the serialized payment list for the authenticated user', async () => {
    const payments = [
      {
        id: 'p2',
        amount: '499',
        currency: 'ETB',
        status: 'succeeded',
        paidAt: new Date(),
        createdAt: new Date(),
        chapaTxRef: 'secret-1',
      },
      {
        id: 'p1',
        amount: '499',
        currency: 'ETB',
        status: 'failed',
        paidAt: null,
        createdAt: new Date(),
        chapaTxRef: 'secret-2',
      },
    ];
    (listPayments as any).mockResolvedValue(payments);

    const req: any = { user: { id: 'user-1' } };
    const res = mockRes();
    const next = vi.fn();

    await getPayments(req, res, next);

    expect(listPayments).toHaveBeenCalledWith('user-1');
    expect(serializePayment).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          payments: [expect.objectContaining({ id: 'p2' }), expect.objectContaining({ id: 'p1' })],
        },
      }),
    );
  });

  it('never lets a chapaTxRef reach the response, even if the service accidentally returned one', async () => {
    (listPayments as any).mockResolvedValue([
      {
        id: 'p1',
        amount: '499',
        currency: 'ETB',
        status: 'succeeded',
        paidAt: new Date(),
        createdAt: new Date(),
        chapaTxRef: 'should-never-leak',
      },
    ]);
    const req: any = { user: { id: 'user-1' } };
    const res = mockRes();
    const next = vi.fn();

    await getPayments(req, res, next);

    const jsonArg = (res.json as any).mock.calls[0][0];
    expect(JSON.stringify(jsonArg)).not.toContain('should-never-leak');
  });

  it('returns an empty array (not an error) when the user has no payments yet', async () => {
    (listPayments as any).mockResolvedValue([]);
    const req: any = { user: { id: 'user-1' } };
    const res = mockRes();
    const next = vi.fn();

    await getPayments(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { payments: [] } }));
  });

  it('forwards service errors to next()', async () => {
    const err = new Error('db down');
    (listPayments as any).mockRejectedValue(err);
    const req: any = { user: { id: 'user-1' } };
    const res = mockRes();
    const next = vi.fn();

    await getPayments(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});
