import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import { prisma } from '../config/db.js';

/**
 * requireGitHubConnection — Doc 8 §8.14.
 * Ensures a connection row exists before GitHub-dependent operations.
 *
 * Failure: 403 with the exact message from Doc 5:
 * "GitHub is not connected. Connect GitHub to continue".
 *
 * Note: A stored connection may contain an invalid/revoked token.
 * Token validation/revocation handling is performed by the GitHub service,
 * not by this middleware.
 */
export const requireGitHubConnection = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user?.id) {
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

/**
 * requireStarterRepo — Doc 8 §8.14.
 * Enforces that a starter repo row exists before ticket operations requiring it.
 *
 * Failure: 409 "Create your starter repository before requesting a ticket".
 */
export const requireStarterRepo = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Not authenticated');
    }

    const repo = await prisma.starterRepo.findUnique({
      where: { userId: req.user.id },
    });

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
