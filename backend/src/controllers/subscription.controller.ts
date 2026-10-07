import type { Response } from 'express';
import { AuthRequest } from '../types/index.js';
import asyncHandler from '../utils/asyncHandler.js';
import { SuccessResponse } from '../utils/ApiResponse.js';
import { HTTP_STATUS } from '../constants/index.js';
import ApiError from '../utils/ApiError.js';
import * as subscriptionService from '../services/subscription.service.js';
import {
  serializeSubscription,
  type SubscriptionDbRecord,
} from '../serializers/subscription.serializer.js';

const requireUser = (req: AuthRequest) => {
  if (!req.user) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated');
  }
  return req.user;
};

/** EP-13: POST /subscriptions/checkout */
export const startCheckout = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = requireUser(req);
  const { checkoutUrl } = await subscriptionService.createCheckout(user.id);
  res.status(HTTP_STATUS.OK).json(
    new SuccessResponse(HTTP_STATUS.OK, 'Checkout session created', {
      checkoutUrl,
    }),
  );
});
export const createCheckout = startCheckout;

/** EP-15: GET /subscriptions/me */
export const getSubscription = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = requireUser(req);
  const { subscription, hasAccess, freeTickets } =
    await subscriptionService.getSubscriptionStatus(user.id);
  res.status(HTTP_STATUS.OK).json(
    new SuccessResponse(HTTP_STATUS.OK, 'Subscription status retrieved', {
      subscription: subscription ? serializeSubscription(subscription as SubscriptionDbRecord) : null,
      hasAccess,
      freeTickets,
    }),
  );
});

/** EP-16: POST /subscriptions/cancel */
export const cancelSubscription = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = requireUser(req);
  const updated = await subscriptionService.cancelSubscription(user.id);
  res.status(HTTP_STATUS.OK).json(
    new SuccessResponse(HTTP_STATUS.OK, 'Subscription canceled successfully', {
      subscription: serializeSubscription(updated as SubscriptionDbRecord),
    }),
  );
});
