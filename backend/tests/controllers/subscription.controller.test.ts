import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/subscription.service', () => ({
  createCheckout: vi.fn(),
  getSubscriptionStatus: vi.fn(),
  cancelSubscription: vi.fn(),
}));

vi.mock('../../src/serializers/subscription.serializer', () => ({
  serializeSubscription: vi.fn((sub: any) => ({
    id: sub.id,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
    canceledAt: sub.canceledAt,
  })),
}));

import * as subscriptionService from '../../src/services/subscription.service';
import { serializeSubscription } from '../../src/serializers/subscription.serializer';
import {
  createCheckout,
  getSubscription,
  cancelSubscription,
} from '../../src/controllers/subscription.controller';

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createCheckout', () => {
  it('returns 201 with the checkout URL on success', async () => {
    (subscriptionService.createCheckout as any).mockResolvedValue({
      checkoutUrl: 'https://checkout.chapa.co/x',
    });
    const req: any = { user: { id: 'user-1' } };
    const res = mockRes();
    const next = vi.fn();

    await createCheckout(req, res, next);

    expect(subscriptionService.createCheckout).toHaveBeenCalledWith('user-1');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { checkoutUrl: 'https://checkout.chapa.co/x' } }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('never reads amount, price, or card data from the request body', async () => {
    (subscriptionService.createCheckout as any).mockResolvedValue({ checkoutUrl: 'https://x' });
    const req: any = {
      user: { id: 'user-1' },
      body: { amount: '1', price: '1', cardNumber: '4111111111111111' }, // should be completely ignored
    };
    const res = mockRes();
    const next = vi.fn();

    await createCheckout(req, res, next);

    // The service call takes only userId — there's no way for the
    // controller to have forwarded any of the body fields even if it wanted to.
    expect(subscriptionService.createCheckout).toHaveBeenCalledWith('user-1');
    expect((subscriptionService.createCheckout as any).mock.calls[0].length).toBe(1);
  });

  it('forwards a 403 (unverified email) from the service straight to next(), unmodified', async () => {
    const err = { statusCode: 403, message: 'Verify your email before subscribing' };
    (subscriptionService.createCheckout as any).mockRejectedValue(err);
    const req: any = { user: { id: 'user-1' } };
    const res = mockRes();
    const next = vi.fn();

    await createCheckout(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.json).not.toHaveBeenCalled();
  });

  it('forwards a 409 (already subscribed) from the service to next()', async () => {
    const err = { statusCode: 409, message: 'You already have an active subscription' };
    (subscriptionService.createCheckout as any).mockRejectedValue(err);
    const req: any = { user: { id: 'user-1' } };
    const res = mockRes();
    const next = vi.fn();

    await createCheckout(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});

describe('getSubscription', () => {
  it('returns the serialized subscription plus hasAccess', async () => {
    const sub = { id: 'sub-1', status: 'active', currentPeriodEnd: new Date(), canceledAt: null };
    (subscriptionService.getSubscriptionStatus as any).mockResolvedValue({
      subscription: sub,
      hasAccess: true,
    });
    const req: any = { user: { id: 'user-1' } };
    const res = mockRes();
    const next = vi.fn();

    await getSubscription(req, res, next);

    expect(serializeSubscription).toHaveBeenCalledWith(sub);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { subscription: expect.objectContaining({ id: 'sub-1' }), hasAccess: true },
      }),
    );
  });

  it('returns subscription: null (not an error) when the user has never subscribed', async () => {
    (subscriptionService.getSubscriptionStatus as any).mockResolvedValue({
      subscription: null,
      hasAccess: false,
    });
    const req: any = { user: { id: 'user-1' } };
    const res = mockRes();
    const next = vi.fn();

    await getSubscription(req, res, next);

    expect(serializeSubscription).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { subscription: null, hasAccess: false } }),
    );
  });

  it('forwards service errors to next()', async () => {
    const err = new Error('db down');
    (subscriptionService.getSubscriptionStatus as any).mockRejectedValue(err);
    const req: any = { user: { id: 'user-1' } };
    const res = mockRes();
    const next = vi.fn();

    await getSubscription(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});

describe('cancelSubscription', () => {
  it('returns 200 with the updated, serialized subscription', async () => {
    const updated = {
      id: 'sub-1',
      status: 'canceled',
      currentPeriodEnd: new Date(),
      canceledAt: new Date(),
    };
    (subscriptionService.cancelSubscription as any).mockResolvedValue(updated);
    const req: any = { user: { id: 'user-1' } };
    const res = mockRes();
    const next = vi.fn();

    await cancelSubscription(req, res, next);

    expect(serializeSubscription).toHaveBeenCalledWith(updated);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { subscription: expect.objectContaining({ status: 'canceled' }) },
      }),
    );
  });

  it('forwards a 409 (nothing to cancel) from the service to next()', async () => {
    const err = { statusCode: 409, message: 'No active subscription to cancel' };
    (subscriptionService.cancelSubscription as any).mockRejectedValue(err);
    const req: any = { user: { id: 'user-1' } };
    const res = mockRes();
    const next = vi.fn();

    await cancelSubscription(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });

  it('forwards a 502 (Chapa call failed) from the service to next()', async () => {
    const err = { statusCode: 502, message: 'Could not cancel with Chapa, please try again' };
    (subscriptionService.cancelSubscription as any).mockRejectedValue(err);
    const req: any = { user: { id: 'user-1' } };
    const res = mockRes();
    const next = vi.fn();

    await cancelSubscription(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});
