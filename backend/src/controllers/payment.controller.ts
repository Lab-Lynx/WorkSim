import type { Response } from 'express';
import { HTTP_STATUS } from '../constants/index.js';
import ApiError from '../utils/ApiError.js';
import { AuthRequest } from '../types/index.js';
import asyncHandler from '../utils/asyncHandler.js';
import { SuccessResponse } from '../utils/ApiResponse.js';
import * as subscriptionService from '../services/subscription.service.js';

export const getPayments = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated');
  const payments = await subscriptionService.listPayments(req.user.id);
  res.status(HTTP_STATUS.OK).json(
    new SuccessResponse(HTTP_STATUS.OK, 'Payments retrieved successfully', { payments }),
  );
});
