import type { Response, CookieOptions } from 'express';
import { env } from '../config/env.js';

const isProd = env.NODE_ENV === 'production';

// Different domains in production (per team decision) => the refresh/access
// cookies must be SameSite=None + Secure, or the browser drops them on the
// cross-site request entirely. Locally, frontend (5173) and backend (3000)
// are both "localhost" — just different ports — which browsers treat as
// same-site, so Lax works there without needing HTTPS.
const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  domain: env.COOKIE_DOMAIN || undefined,
};

/**
 * Turns a jsonwebtoken `expiresIn` style string ("15m", "30d", "3600s")
 * into milliseconds, for use as a cookie's maxAge. Falls back to 15 minutes
 * on anything it can't parse — fails safe (short-lived), not open-ended.
 */
export function parseDurationToMs(duration: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)?$/i.exec(duration.trim());
  if (!match) return 15 * 60 * 1000;

  const value = Number(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export const setAuthCookies = (res: Response, tokens: AuthTokens): void => {
  res.cookie('accessToken', tokens.accessToken, {
    ...baseCookieOptions,
    path: '/',
    maxAge: parseDurationToMs(env.ACCESS_TOKEN_EXPIRES_IN),
  });

  res.cookie('refreshToken', tokens.refreshToken, {
    ...baseCookieOptions,
    // Scoped to the auth routes only — no reason to send the refresh
    // token on every single API call, only when actually refreshing.
    path: '/api/v1/auth',
    maxAge: parseDurationToMs(env.REFRESH_TOKEN_EXPIRES_IN),
  });
};

export const clearAuthCookies = (res: Response): void => {
  res.clearCookie('accessToken', { ...baseCookieOptions, path: '/' });
  res.clearCookie('refreshToken', { ...baseCookieOptions, path: '/api/v1/auth' });
};
