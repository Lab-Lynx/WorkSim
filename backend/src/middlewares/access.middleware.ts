import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import { prisma } from '../config/db.js';
import { hasPaidAccess } from '../services/subscription.service.js';

/** Doc 5 "+ Sub" gate — uses hasPaidAccess, does not re-implement the rule. */
export const requirePaidAccess = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated');
    }
    const ok = await hasPaidAccess(req.user.id);
    if (!ok) {
      throw new ApiError(HTTP_STATUS.PAYMENT_REQUIRED, 'An active subscription is required');
    }
    next();
  } catch (err) {
    next(err);
  }
};

export const requireGitHubConnection = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated');
    }
    const connection = await prisma.gitHubConnection.findUnique({
      where: { userId: req.user.id },
    });
    if (!connection) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'GitHub is not connected. Connect GitHub to continue',
      );
    }
    next();
  } catch (err) {
    next(err);
  }
};

export const requireStarterRepo = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated');
    }
    const repo = await prisma.starterRepo.findUnique({ where: { userId: req.user.id } });
    if (!repo) {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        'Create your starter repository before requesting a ticket',
      );
    }
    next();
  } catch (err) {
    next(err);
  }
};
