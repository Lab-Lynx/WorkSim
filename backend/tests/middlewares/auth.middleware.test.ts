import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import type { AuthRequest } from '../../src/types/index.js';
import authMiddleware from '../../src/middlewares/auth.middleware.js';
import { HTTP_STATUS } from '../../src/constants/index.js';
import * as jwtUtils from '../../src/utils/jwt.js';

describe('auth.middleware (requireAuth — Doc 8 §8.14, Doc 9 §9.3.5)', () => {
  it('passes and attaches user when valid accessToken cookie is provided', () => {
    const payload = { id: 'user-123', role: 'user' };
    vi.spyOn(jwtUtils, 'verifyAccessToken').mockReturnValue(payload as never);

    const req = { cookies: { accessToken: 'valid-token' } } as unknown as AuthRequest;
    const res = {} as unknown as Response;
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(jwtUtils.verifyAccessToken).toHaveBeenCalledWith('valid-token');
    expect(req.user).toEqual(payload);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects with 401 when accessToken cookie is missing', () => {
    const req = { cookies: {} } as unknown as AuthRequest;
    const res = {} as unknown as Response;
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        message: 'Invalid or expired access token',
      }),
    );
  });

  it('rejects with 401 when token verification throws (expired/tampered)', () => {
    vi.spyOn(jwtUtils, 'verifyAccessToken').mockImplementation(() => {
      throw new Error('jwt expired');
    });

    const req = { cookies: { accessToken: 'expired-token' } } as unknown as AuthRequest;
    const res = {} as unknown as Response;
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        message: 'Invalid or expired access token',
      }),
    );
  });

  /**
   * Doc 9 §9.3.5 last row:
   * "requireAuth (existing) — Bearer alone | valid access token only in an Authorization: Bearer header, no cookie | run middleware | 401"
   */
  it('rejects a Bearer-only token with 401 when no cookie is present', () => {
    const req = {
      headers: {
        authorization: 'Bearer valid.jwt.token',
      },
      cookies: {},
    } as unknown as AuthRequest;
    const res = {} as unknown as Response;
    const next = vi.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        message: 'Invalid or expired access token',
      }),
    );
  });
});
