import { Response } from 'express';
import { AuthRequest } from '../types/index.js';
import asyncHandler from '../utils/asyncHandler.js';
import { SuccessResponse } from '../utils/ApiResponse.js';
import { HTTP_STATUS } from '../constants/index.js';
import ApiError from '../utils/ApiError.js';
import * as subscriptionService from '../services/subscription.service.js';
import { serializePayment } from '../serializers/payment.serializer.js';

const requireUser = (req: AuthRequest) => {
  if (!req.user) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated');
  }
  return req.user;
};

/** EP-17: GET /payments */
export const getPayments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = requireUser(req);
  const payments = await subscriptionService.listPayments(user.id);
  res.status(HTTP_STATUS.OK).json(
    new SuccessResponse(HTTP_STATUS.OK, 'Payment history', {
      payments: payments.map(serializePayment),
    }),
  );
});
