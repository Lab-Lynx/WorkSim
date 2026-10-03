import { Request, Response, NextFunction } from 'express';
import {
  createCheckout as createCheckoutService,
  getSubscriptionStatus,
  cancelSubscription as cancelSubscriptionService,
} from '../services/subscription.service';
import { serializeSubscription } from '../serializers/subscription.serializer';

// POST /subscriptions/checkout
export async function createCheckout(req: Request, res: Response, next: NextFunction) {
  try {
    // Note: only userId is ever passed through — req.body is never touched
    // here, which is what makes "never read price/card data from the
    // request" true by construction, not just by convention.
    const { checkoutUrl } = await createCheckoutService((req as any).user.id);
    res.status(201).json({
      statusCode: 201,
      success: true,
      message: 'Checkout created',
      data: { checkoutUrl },
    });
  } catch (err) {
    next(err);
  }
}

// GET /subscriptions/me
export async function getSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const { subscription, hasAccess } = await getSubscriptionStatus((req as any).user.id);
    res.status(200).json({
      statusCode: 200,
      success: true,
      message: 'Subscription status',
      data: {
        subscription: subscription ? serializeSubscription(subscription as any) : null,
        hasAccess,
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /subscriptions/cancel
export async function cancelSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const updated = await cancelSubscriptionService((req as any).user.id);
    res.status(200).json({
      statusCode: 200,
      success: true,
      message: 'Subscription canceled',
      data: { subscription: serializeSubscription(updated as any) },
    });
  } catch (err) {
    next(err);
  }
}
