import type { Response } from 'express';
import { HTTP_STATUS } from '../constants/index.js';
import ApiError from '../utils/ApiError.js';
import { AuthRequest } from '../types/index.js';
import asyncHandler from '../utils/asyncHandler.js';
import { SuccessResponse } from '../utils/ApiResponse.js';
import * as subscriptionService from '../services/subscription.service.js';

export const startCheckout = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated');
  const { checkoutUrl } = await subscriptionService.createCheckout(req.user.id);
  res.status(HTTP_STATUS.OK).json(
    new SuccessResponse(HTTP_STATUS.OK, 'Checkout session created', { checkoutUrl }),
  );
});

export const getSubscription = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated');
  const result = await subscriptionService.getSubscriptionStatus(req.user.id);
  res.status(HTTP_STATUS.OK).json(
    new SuccessResponse(HTTP_STATUS.OK, 'Subscription status retrieved', result),
  );
});

export const cancelSubscription = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated');
  const subscription = await subscriptionService.cancelSubscription(req.user.id);
  res.status(HTTP_STATUS.OK).json(
    new SuccessResponse(HTTP_STATUS.OK, 'Subscription canceled successfully', { subscription }),
  );
});
