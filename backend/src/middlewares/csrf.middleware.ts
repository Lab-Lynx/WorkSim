import type { NextFunction, Request, Response } from 'express';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';
import { env } from '../config/env.js';

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const getRequestOrigin = (req: Request): string | undefined => {
  const origin = req.get('origin');
  if (origin) {
    return origin;
  }

  const referer = req.get('referer');
  if (!referer) {
    return undefined;
  }

  try {
    return new URL(referer).origin;
  } catch {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Untrusted request origin');
  }
};

const csrfMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  if (!unsafeMethods.has(req.method)) {
    next();
    return;
  }

  const hasAuthCookie = Boolean(req.cookies?.accessToken || req.cookies?.refreshToken);
  if (!hasAuthCookie) {
    next();
    return;
  }

  const requestOrigin = getRequestOrigin(req);
  // Non-browser clients do not send Origin/Referer. Browser requests that do
  // send either header must match the configured frontend origin.
  if (requestOrigin && requestOrigin !== env.CLIENT_URL) {
    next(new ApiError(HTTP_STATUS.FORBIDDEN, 'Untrusted request origin'));
    return;
  }

  next();
};

export default csrfMiddleware;
