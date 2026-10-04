import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import { hasPaidAccess } from '../services/subscription.service.js';

/**
 * requirePaidAccess — the + Sub gate for paid-resource routes (Doc 8 §8.14).
 * Enforces that the authenticated user has an active or valid subscription
 * with a future currentPeriodEnd via hasPaidAccess.
 *
 * Failure: 402 "An active subscription is required".
 */
export const requirePaidAccess = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated');
    }

    const ok = await hasPaidAccess(req.user.id);
    if (!ok) {
      throw new ApiError(
        HTTP_STATUS.PAYMENT_REQUIRED,
        'An active subscription is required',
      );
    }

    return next();
  } catch (err) {
    return next(err);
  }
};
