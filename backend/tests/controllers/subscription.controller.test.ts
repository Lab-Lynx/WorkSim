import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTP_STATUS } from '../../src/constants/index.js';

const createCheckout = vi.fn();
const getSubscriptionStatus = vi.fn();
const cancelSubscription = vi.fn();

vi.mock('../../src/services/subscription.service.js', () => ({
  createCheckout,
  getSubscriptionStatus,
  cancelSubscription,
}));

const { startCheckout, getSubscription, cancelSubscription: cancelSubCtrl } = await import(
  '../../src/controllers/subscription.controller.js'
);

describe('subscription.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startCheckout', () => {
    it('creates checkout session and returns 200 with checkoutUrl', async () => {
      createCheckout.mockResolvedValue({ checkoutUrl: 'https://checkout.chapa.co/test' });
      const req = { user: { id: 'user-1' } };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await startCheckout(req as never, res as never, next);

      expect(createCheckout).toHaveBeenCalledWith('user-1');
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 200,
          success: true,
          data: { checkoutUrl: 'https://checkout.chapa.co/test' },
        }),
      );
    });
  });

  describe('getSubscription', () => {
    it('returns 200 with subscription status and hasAccess', async () => {
      const mockResult = {
        subscription: {
          id: 'sub-1',
          status: 'active',
          currentPeriodEnd: '2026-11-01T00:00:00.000Z',
          canceledAt: null,
        },
        hasAccess: true,
      };
      getSubscriptionStatus.mockResolvedValue(mockResult);
      const req = { user: { id: 'user-1' } };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await getSubscription(req as never, res as never, next);

      expect(getSubscriptionStatus).toHaveBeenCalledWith('user-1');
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 200,
          success: true,
          data: mockResult,
        }),
      );
    });
  });

  describe('cancelSubscription', () => {
    it('cancels subscription and returns 200 with updated subscription', async () => {
      const mockSub = {
        id: 'sub-1',
        status: 'canceled',
        currentPeriodEnd: '2026-11-01T00:00:00.000Z',
        canceledAt: '2026-10-04T12:00:00.000Z',
      };
      cancelSubscription.mockResolvedValue(mockSub);
      const req = { user: { id: 'user-1' } };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await cancelSubCtrl(req as never, res as never, next);

      expect(cancelSubscription).toHaveBeenCalledWith('user-1');
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 200,
          success: true,
          data: { subscription: mockSub },
        }),
      );
    });
  });
});
