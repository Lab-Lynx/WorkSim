import { Response } from 'express';
import { AuthRequest } from '../types/index.js';
import asyncHandler from '../utils/asyncHandler.js';
import { SuccessResponse } from '../utils/ApiResponse.js';
import { HTTP_STATUS } from '../constants/index.js';
import ApiError from '../utils/ApiError.js';
import { setAuthCookies, clearAuthCookies } from '../utils/cookies.js';
import * as authService from '../services/auth.service.js';
import * as emailService from '../services/email.service.js';

const toPublicUser = (user: authService.SafeUser) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
  createdAt: user.createdAt.toISOString(),
});

/**
 * EP-01 — create account, log in, send verification email.
 * Email-send failure must not undo the account or session (Doc 5).
 */
export const register = asyncHandler(async (req, res: Response) => {
  const { name, email, password } = req.body as {
    name: string;
    email: string;
    password: string;
  };

  const { user, verificationToken } = await authService.registerUser(name, email, password);
  const tokens = await authService.issueTokens(user);
  setAuthCookies(res, tokens);

  try {
    await emailService.sendVerificationEmail(user.email, verificationToken);
  } catch {
    // Account + session already created — EP-07 can resend.
  }

  res.status(HTTP_STATUS.CREATED).json(
    new SuccessResponse(HTTP_STATUS.CREATED, 'User registered', {
      user: toPublicUser(user),
    }),
  );
});

export const login = asyncHandler(async (req, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };

  const user = await authService.validateCredentials(email, password);
  const tokens = await authService.issueTokens(user);
  setAuthCookies(res, tokens);

  res
    .status(HTTP_STATUS.OK)
    .json(new SuccessResponse(HTTP_STATUS.OK, 'Logged in', { user: toPublicUser(user) }));
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

/** EP-05 — revoke every refresh token for the user and clear cookies. */
export const logoutAll = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated');
  }

  await authService.revokeAllSessions(req.user.id);
  clearAuthCookies(res);
  res
    .status(HTTP_STATUS.OK)
    .json(new SuccessResponse(HTTP_STATUS.OK, 'Logged out of all devices', null));
});

/** Existing convenience endpoint — keep behavior, enrich public user shape. */
export const me = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated');
  }

  const user = await authService.getUserById(req.user.id);
  res
    .status(HTTP_STATUS.OK)
    .json(new SuccessResponse(HTTP_STATUS.OK, 'Current user', { user: toPublicUser(user) }));
});

/** EP-06 */
export const verifyEmail = asyncHandler(async (req, res: Response) => {
  const { token } = req.body as { token: string };
  const result = await authService.verifyEmail(token);

  res.status(HTTP_STATUS.OK).json(
    new SuccessResponse(
      HTTP_STATUS.OK,
      result.alreadyVerified ? 'Email already verified' : 'Email verified',
      { emailVerifiedAt: result.emailVerifiedAt.toISOString() },
    ),
  );
});

/** EP-07 — always the same non-enumerating message. */
export const resendVerification = asyncHandler(async (req, res: Response) => {
  const { email } = req.body as { email: string };
  await authService.resendVerificationEmail(email);

  res.status(HTTP_STATUS.OK).json(
    new SuccessResponse(
      HTTP_STATUS.OK,
      'If an unverified account exists for this email, a new verification link has been sent',
      null,
    ),
  );
});

/** EP-08 */
export const forgotPassword = asyncHandler(async (req, res: Response) => {
  const { email } = req.body as { email: string };
  await authService.requestPasswordReset(email);

  res.status(HTTP_STATUS.OK).json(
    new SuccessResponse(
      HTTP_STATUS.OK,
      'If an account exists for this email, a reset link has been sent',
      null,
    ),
  );
});

/** EP-09 */
export const resetPassword = asyncHandler(async (req, res: Response) => {
  const { token, newPassword } = req.body as { token: string; newPassword: string };
  await authService.resetPassword(token, newPassword);

  res
    .status(HTTP_STATUS.OK)
    .json(new SuccessResponse(HTTP_STATUS.OK, 'Password reset', null));
});

/** EP-10 */
export const changePassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated');
  }

  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };

  await authService.changePassword(req.user.id, currentPassword, newPassword);

  res
    .status(HTTP_STATUS.OK)
    .json(new SuccessResponse(HTTP_STATUS.OK, 'Password changed', null));
});
