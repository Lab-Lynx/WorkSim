import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import errorMiddleware from '../../src/middlewares/error.middleware.js';
import ApiError from '../../src/utils/ApiError.js';
import { ErrorResponse } from '../../src/utils/ApiResponse.js';
import { HTTP_STATUS } from '../../src/constants/index.js';
import logger from '../../src/utils/logger.js';
import { env } from '../../src/config/env.js';

function mockReq(method = 'POST', path = '/api/v1/auth/login'): Request {
  return {
    method,
    path,
  } as unknown as Request;
}

function mockRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('error.middleware (Doc 8 §8.14, Doc 9 §9.3.5)', () => {
  const next: NextFunction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(logger, 'error').mockImplementation(() => logger);
  });

  describe('handling operational errors (ApiError)', () => {
    it('formats validation 400 ApiError into standardized ErrorResponse with field-specific errors', () => {
      const fieldErrors = [
        'body.name: Name must be at least 2 characters',
        'body.email: Invalid email address',
        'body.password: Password must be at least 8 characters',
      ];
      const apiError = new ApiError(HTTP_STATUS.BAD_REQUEST, 'Validation failed', fieldErrors);
      const req = mockReq('POST', '/api/v1/auth/register');
      const res = mockRes();

      errorMiddleware(apiError, req, res, next);

      expect(logger.error).toHaveBeenCalledWith(apiError, '[POST] /api/v1/auth/register');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          success: false,
          message: 'Validation failed',
          errors: fieldErrors,
          data: null,
        }),
      );
      expect(res.json).toHaveBeenCalledWith(expect.any(ErrorResponse));
    });

    it('formats auth 401 ApiError into standardized ErrorResponse with empty errors array', () => {
      const authError = new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired access token');
      const req = mockReq('GET', '/api/v1/users/me');
      const res = mockRes();

      errorMiddleware(authError, req, res, next);

      expect(logger.error).toHaveBeenCalledWith(authError, '[GET] /api/v1/users/me');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          success: false,
          message: 'Invalid or expired access token',
          errors: [],
          data: null,
        }),
      );
    });

    it('formats 402, 403, and 409 operational access errors correctly', () => {
      const testCases = [
        { code: HTTP_STATUS.PAYMENT_REQUIRED, msg: 'An active subscription is required' },
        { code: HTTP_STATUS.FORBIDDEN, msg: 'GitHub is not connected. Connect GitHub to continue' },
        { code: HTTP_STATUS.CONFLICT, msg: 'Create your starter repository before requesting a ticket' },
      ];

      for (const { code, msg } of testCases) {
        const error = new ApiError(code, msg);
        const req = mockReq('POST', '/api/v1/tickets');
        const res = mockRes();

        errorMiddleware(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(code);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: code,
            success: false,
            message: msg,
            errors: [],
            data: null,
          }),
        );
      }
    });
  });

  describe('handling unexpected system errors (native Error)', () => {
    it('returns 500 with actual error message in development/test mode', () => {
      const rawError = new Error('Database connection reset by peer');
      const req = mockReq('POST', '/api/v1/tickets');
      const res = mockRes();

      const origEnv = env.NODE_ENV;
      (env as { NODE_ENV: string }).NODE_ENV = 'test';

      try {
        errorMiddleware(rawError, req, res, next);

        expect(logger.error).toHaveBeenCalledWith(rawError, '[POST] /api/v1/tickets');
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 500,
            success: false,
            message: 'Database connection reset by peer',
            errors: [],
            data: null,
          }),
        );
      } finally {
        (env as { NODE_ENV: string }).NODE_ENV = origEnv;
      }
    });

    it('returns 500 with generic "Internal server error" in production mode (hiding system details)', () => {
      const sensitiveError = new Error('Postgres password authentication failed for user "postgres"');
      const req = mockReq('POST', '/api/v1/tickets');
      const res = mockRes();

      const origEnv = env.NODE_ENV;
      (env as { NODE_ENV: string }).NODE_ENV = 'production';

      try {
        errorMiddleware(sensitiveError, req, res, next);

        expect(logger.error).toHaveBeenCalledWith(sensitiveError, '[POST] /api/v1/tickets');
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 500,
            success: false,
            message: 'Internal server error',
            errors: [],
            data: null,
          }),
        );
        // Ensure sensitive error message was NOT leaked in the response
        const jsonCall = vi.mocked(res.json).mock.calls[0][0] as ErrorResponse;
        expect(jsonCall.message).not.toContain('Postgres password');
      } finally {
        (env as { NODE_ENV: string }).NODE_ENV = origEnv;
      }
    });
  });
});
