import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { clearAuthCookies, setAuthCookies } from '../../src/utils/cookies.js';

describe('auth cookie scope', () => {
  it('scopes refresh tokens to auth routes while access tokens remain available to the API', () => {
    const cookie = vi.fn();
    setAuthCookies({ cookie } as unknown as Response, {
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    expect(cookie).toHaveBeenNthCalledWith(
      1,
      'accessToken',
      'access',
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
    expect(cookie).toHaveBeenNthCalledWith(
      2,
      'refreshToken',
      'refresh',
      expect.objectContaining({ httpOnly: true, path: '/api/v1/auth' }),
    );
  });

  it('clears cookies using the same paths used when setting them', () => {
    const clearCookie = vi.fn();
    clearAuthCookies({ clearCookie } as unknown as Response);

    expect(clearCookie).toHaveBeenNthCalledWith(
      1,
      'accessToken',
      expect.objectContaining({ path: '/' }),
    );
    expect(clearCookie).toHaveBeenNthCalledWith(
      2,
      'refreshToken',
      expect.objectContaining({ path: '/api/v1/auth' }),
    );
  });
});
