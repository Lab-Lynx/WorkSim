import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../lib/errors/ApiError';

export function requireAdminKey(req: Request, _res: Response, next: NextFunction): void {
  const expected = process.env.ADMIN_MODERATION_KEY;
  if (!expected) {
    // Fail closed: a forgotten env var must never silently become "anyone can moderate."
    next(new ApiError(500, 'Admin moderation key is not configured'));
    return;
  }

  const provided = req.header('x-admin-key') ?? '';
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);

  const matches =
    expectedBuf.length === providedBuf.length && crypto.timingSafeEqual(expectedBuf, providedBuf);

  if (!matches) {
    next(new ApiError(401, 'Invalid admin key'));
    return;
  }

  next();
}
