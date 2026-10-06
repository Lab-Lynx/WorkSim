import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import csrfMiddleware from '../../src/middlewares/csrf.middleware.js';

const createRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    method: 'POST',
    cookies: { accessToken: 'access-token' },
    get: vi.fn((header: string) => {
      if (header === 'origin') return 'http://localhost:5173';
      return undefined;
    }),
    ...overrides,
  }) as Request;

describe('csrfMiddleware', () => {
  it('allows authenticated requests from the configured frontend origin', () => {
    const next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;

    csrfMiddleware(createRequest(), {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects authenticated requests from an untrusted origin', () => {
    const next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
    const req = createRequest({
      get: vi.fn((header: string) =>
        header === 'origin' ? 'https://evil.example' : undefined,
      ) as unknown as Request['get'],
    });

    csrfMiddleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: 'Untrusted request origin',
      }),
    );
  });

  it('allows public requests without authentication cookies', () => {
    const next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
    const req = createRequest({
      cookies: {},
      get: vi.fn(() => 'https://evil.example') as unknown as Request['get'],
    });

    csrfMiddleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'checks the configured origin for authenticated %s requests',
    (method) => {
      const next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
      const req = createRequest({
        method,
        get: vi.fn((header: string) =>
          header === 'origin' ? 'https://evil.example' : undefined,
        ) as unknown as Request['get'],
      });

      csrfMiddleware(req, {} as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: 'Untrusted request origin',
        }),
      );
    },
  );
});
