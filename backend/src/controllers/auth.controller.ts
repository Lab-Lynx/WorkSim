import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import asyncHandler from '../utils/asyncHandler.js';
import { SuccessResponse } from '../utils/ApiResponse.js';
import { HTTP_STATUS } from '../constants/index.js';
import ApiError from '../utils/ApiError.js';
import { setAuthCookies, clearAuthCookies } from '../utils/cookies.js';
import * as authService from '../services/auth.service.js';

export const register = asyncHandler(async (req, res: Response) => {
  const { email, password } = req.body;

  const user = await authService.registerUser(email, password);
  const tokens = await authService.issueTokens(user);
  setAuthCookies(res, tokens);

  res
    .status(HTTP_STATUS.CREATED)
    .json(new SuccessResponse(HTTP_STATUS.CREATED, 'Account created', { user }));
});

export const login = asyncHandler(async (req, res: Response) => {
  const { email, password } = req.body;

  const user = await authService.validateCredentials(email, password);
  const tokens = await authService.issueTokens(user);
  setAuthCookies(res, tokens);

  // Tokens are intentionally NOT in this body — they only exist as httpOnly
  // cookies. Putting them here too would defeat the point (readable by JS).
  res.status(HTTP_STATUS.OK).json(new SuccessResponse(HTTP_STATUS.OK, 'Logged in', { user }));
});

export const refresh = asyncHandler(async (req: AuthRequest, res: Response) => {
  const rawRefreshToken = req.cookies?.refreshToken as string | undefined;

  if (!rawRefreshToken) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'No refresh token provided');
  }

  const tokens = await authService.rotateRefreshToken(rawRefreshToken);
  setAuthCookies(res, tokens);

  res.status(HTTP_STATUS.OK).json(new SuccessResponse(HTTP_STATUS.OK, 'Session refreshed', null));
});

export const logout = asyncHandler(async (req: AuthRequest, res: Response) => {
  const rawRefreshToken = req.cookies?.refreshToken as string | undefined;

  if (rawRefreshToken) {
    await authService.revokeRefreshToken(rawRefreshToken);
  }

  clearAuthCookies(res);
  res.status(HTTP_STATUS.OK).json(new SuccessResponse(HTTP_STATUS.OK, 'Logged out', null));
});

export const me = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated'));
  }

  const user = await authService.getUserById(req.user.id);
  res.status(HTTP_STATUS.OK).json(new SuccessResponse(HTTP_STATUS.OK, 'Current user', user));
});
