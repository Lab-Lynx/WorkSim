import rateLimit from 'express-rate-limit';
import { ErrorResponse } from '../utils/ApiResponse.js'; // 🟢 Consolidated API layout
import { HTTP_STATUS } from '../constants/index.js';
import { env } from '../config/env.js';

export const defaultLimiter = rateLimit({
  windowMs: env.DEFAULT_RATE_LIMIT_WINDOW_MS,
  max: env.DEFAULT_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  // 🟢 Intercept the limitation event and route it through your design system
  handler: (req, res) => {
    return res
      .status(HTTP_STATUS.TOO_MANY_REQUESTS)
      .json(
        new ErrorResponse(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'Too many requests, please try again later.',
          []
        )
      );
  },
});

export const authLimiter = rateLimit({
  windowMs: env.DEFAULT_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res
      .status(HTTP_STATUS.TOO_MANY_REQUESTS)
      .json(
        new ErrorResponse(
          HTTP_STATUS.TOO_MANY_REQUESTS,
          'Too many login attempts, please try again later.',
          []
        )
      );
  },
});

const costLimiter = (max: number, windowMs: number, message: string) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) =>
      res
        .status(HTTP_STATUS.TOO_MANY_REQUESTS)
        .json(new ErrorResponse(HTTP_STATUS.TOO_MANY_REQUESTS, message, [])),
  });

// These limits are deliberately server-side and protect provider/AI spend.
export const registrationLimiter = costLimiter(
  env.REGISTRATION_RATE_LIMIT_MAX,
  env.REGISTRATION_RATE_LIMIT_WINDOW_MS,
  'Too many registration attempts, please try again later.',
);
export const ticketAssignmentLimiter = costLimiter(
  env.COST_RATE_LIMIT_MAX,
  env.COST_RATE_LIMIT_WINDOW_MS,
  'Too many ticket assignment attempts, please try again later.',
);
export const submissionLimiter = costLimiter(
  env.COST_RATE_LIMIT_MAX,
  env.COST_RATE_LIMIT_WINDOW_MS,
  'Too many submission attempts, please try again later.',
);
export const mentorRequestLimiter = costLimiter(
  env.MENTOR_RATE_LIMIT_MAX,
  env.COST_RATE_LIMIT_WINDOW_MS,
  'Too many mentor requests, please try again later.',
);