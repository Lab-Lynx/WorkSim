import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTP_STATUS } from '../../src/constants/index.js';

const listPayments = vi.fn();

vi.mock('../../src/services/subscription.service.js', () => ({
  listPayments,
}));

const { getPayments } = await import('../../src/controllers/payment.controller.js');

describe('payment.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPayments', () => {
    it('returns 200 with list of payments', async () => {
      const mockPayments = [
        {
          id: 'pay-1',
          amount: '29',
          currency: 'ETB',
          status: 'succeeded',
          paidAt: '2026-10-01T00:00:00.000Z',
          createdAt: '2026-10-01T00:00:00.000Z',
        },
      ];
      listPayments.mockResolvedValue(mockPayments);
      const req = { user: { id: 'user-1' } };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await getPayments(req as never, res as never, next);

      expect(listPayments).toHaveBeenCalledWith('user-1');
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 200,
          success: true,
          data: { payments: mockPayments },
        }),
      );
    });
  });
});
