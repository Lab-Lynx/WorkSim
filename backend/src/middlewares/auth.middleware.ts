import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import { verifyAccessToken } from '../utils/jwt.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';

const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Access token lives in an httpOnly cookie — never read from a header
    // here, since the frontend never has JS-level access to it either.
    const token = req.cookies?.accessToken as string | undefined;

    if (!token) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'No access token provided');
    }

    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired access token'));
  }
};

export default authMiddleware;
