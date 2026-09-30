import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { z } from 'zod';
import validate from '../../src/middlewares/validate.middleware.js';
import ApiError from '../../src/utils/ApiError.js';
import { HTTP_STATUS } from '../../src/constants/index.js';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../../src/validators/auth.validators.js';
import { updateDisplayNameSchema } from '../../src/validators/user.validators.js';
import { getTicketParamsSchema } from '../../src/validators/ticket.validators.js';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {},
    query: {},
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('validate.middleware (Doc 8 §8.14, Doc 9 §9.3.5)', () => {
  describe('register schema — field-specific error messages (Doc 9 §9.3.5)', () => {
    it('fails with field-specific messages when name is 1 char, email is invalid, and password is 7 chars', async () => {
      const middleware = validate(registerSchema);
      const req = mockReq({
        body: {
          name: 'A',
          email: 'not-an-email',
          password: 'short12',
        },
      });
      const res = mockRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(err.message).toBe('Validation failed');
      expect(err.errors).toEqual(
        expect.arrayContaining([
          'body.name: Name must be at least 2 characters',
          'body.email: Invalid email address',
          'body.password: Password must be at least 8 characters',
        ]),
      );
    });

    it('7-character password alone gives exact message "Password must be at least 8 characters"', async () => {
      const middleware = validate(registerSchema);
      const req = mockReq({
        body: {
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          password: 'seven77',
        },
      });
      const res = mockRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(err.errors).toContain('body.password: Password must be at least 8 characters');
    });

    it('valid registration body passes and calls next() with no errors', async () => {
      const middleware = validate(registerSchema);
      const req = mockReq({
        body: {
          name: '  Ada Lovelace  ',
          email: 'ada@example.com',
          password: 'validPassword123',
        },
      });
      const res = mockRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(req.body.name).toBe('Ada Lovelace');
    });
  });

  describe('other schemas — field-specific 400 messages (Doc 9 §9.3.5)', () => {
    it('login without password yields field-specific 400 message', async () => {
      const middleware = validate(loginSchema);
      const req = mockReq({ body: { email: 'ada@example.com' } });
      const res = mockRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(400);
      expect(err.errors).toContain('body.password: Password is required');
    });

    it('verify email without token yields field-specific 400 message', async () => {
      const middleware = validate(verifyEmailSchema);
      const req = mockReq({ body: {} });
      const res = mockRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(400);
      expect(err.errors).toContain('body.token: Token is required');
    });

    it('reset password with 7 characters yields field-specific 400 message', async () => {
      const middleware = validate(resetPasswordSchema);
      const req = mockReq({ body: { token: 'reset-token-123', newPassword: 'short12' } });
      const res = mockRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(400);
      expect(err.errors).toContain('body.newPassword: Password must be at least 8 characters');
    });

    it('change-password without current password yields field-specific 400 message', async () => {
      const middleware = validate(changePasswordSchema);
      const req = mockReq({ body: { newPassword: 'newValidPassword123' } });
      const res = mockRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(400);
      expect(err.errors).toContain('body.currentPassword: Current password is required');
    });

    it('profile name of only spaces yields field-specific 400 message', async () => {
      const middleware = validate(updateDisplayNameSchema);
      const req = mockReq({ body: { name: '     ' } });
      const res = mockRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(400);
      expect(err.errors).toContain('body.name: Name must be at least 2 characters');
    });
  });

  describe('params schemas (Doc 9 §9.3.5)', () => {
    it('non-UUID ticketId produces field-specific 400 error on params.ticketId', async () => {
      const middleware = validate(getTicketParamsSchema);
      const req = mockReq({ params: { ticketId: 'not-a-uuid-123' } });
      const res = mockRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(400);
      expect(err.errors).toContain('params.ticketId: ticketId must be a valid UUID');
    });

    it('valid UUID ticketId passes and populates req.params', async () => {
      const validUuid = '11111111-2222-4333-8444-555555555555';
      const middleware = validate(getTicketParamsSchema);
      const req = mockReq({ params: { ticketId: validUuid } });
      const res = mockRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(req.params.ticketId).toBe(validUuid);
    });
  });

  describe('Express 5 query isolation and query schemas (Doc 9 §9.3.5, AGENTS.md)', () => {
    const queryTestSchema = z.object({
      query: z.object({
        attempt: z.coerce.number().int().min(1).max(2),
        includeDiff: z.enum(['true', 'false']).transform((v) => v === 'true'),
      }),
    });

    it('rejects bad query parameters (attempt 0 or 3, invalid includeDiff)', async () => {
      const middleware = validate(queryTestSchema);
      const req = mockReq({
        query: { attempt: '0', includeDiff: 'maybe' } as unknown as Request['query'],
      });
      const res = mockRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(400);
      expect(err.errors.some((e: string) => e.includes('query.attempt'))).toBe(true);
      expect(err.errors.some((e: string) => e.includes('query.includeDiff'))).toBe(true);
    });

    it('sets req.validatedQuery with transformed types without mutating getter-only req.query', async () => {
      const middleware = validate(queryTestSchema);
      const rawQuery = { attempt: '1', includeDiff: 'true' };
      const req = mockReq({ query: rawQuery as unknown as Request['query'] });

      // Emulate Express 5 getter-only req.query
      Object.defineProperty(req, 'query', {
        get: () => rawQuery,
        configurable: true,
      });

      const res = mockRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(req.validatedQuery).toEqual({
        attempt: 1,
        includeDiff: true,
      });
      expect(req.query).toBe(rawQuery);
    });
  });

  describe('non-Zod error propagation (Doc 8 §8.14)', () => {
    it('forwards unexpected non-Zod errors directly to next(err)', async () => {
      const unexpectedError = new Error('Unexpected crash in refinement');
      const explodingSchema = {
        parseAsync: vi.fn().mockRejectedValue(unexpectedError),
      } as unknown as z.ZodSchema;

      const middleware = validate(explodingSchema);
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(unexpectedError);
    });
  });
});
