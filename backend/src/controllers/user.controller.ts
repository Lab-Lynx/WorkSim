import { Response } from 'express';
import { AuthRequest } from '../types/index.js';
import asyncHandler from '../utils/asyncHandler.js';
import { SuccessResponse } from '../utils/ApiResponse.js';
import { HTTP_STATUS } from '../constants/index.js';
import ApiError from '../utils/ApiError.js';
import { serializeUser } from '../serializers/user.serializer.js';
import * as userService from '../services/user.service.js';

export const getMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated');
  }

  const user = await userService.getCurrentUser(req.user.id);

  res
    .status(HTTP_STATUS.OK)
    .json(
      new SuccessResponse(HTTP_STATUS.OK, 'Current user', {
        user: serializeUser(user),
      }),
    );
});

export const updateMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated');
  }

  const { name } = req.body as { name: string };
  const user = await userService.updateDisplayName(req.user.id, name);

  res
    .status(HTTP_STATUS.OK)
    .json(
      new SuccessResponse(HTTP_STATUS.OK, 'Profile updated', {
        user: serializeUser(user),
      }),
    );
});
