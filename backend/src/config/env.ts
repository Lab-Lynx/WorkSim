import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string(),

  // Access token — short-lived, sent on every request via cookie.
  ACCESS_TOKEN_SECRET: z.string(),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),

  // Refresh token — long-lived, only sent to /api/v1/auth/*, tracked in
  // the DB (hashed) so it can be revoked on logout or reuse detection.
  REFRESH_TOKEN_SECRET: z.string(),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('30d'),

  BCRYPT_SALT_ROUNDS: z.string().default('10'),

  // The frontend's origin. Required for CORS + cookies to work at all:
  // credentials:true CORS cannot pair with a wildcard "*" origin, and the
  // browser needs an exact origin to trust for cross-site cookies.
  CLIENT_URL: z.string().url().default('http://localhost:5173'),

  // Only needed if frontend and backend share a parent domain in production
  // (e.g. api.example.com / app.example.com) and you want the cookie valid
  // across both. Leave unset for fully separate domains or local dev.
  COOKIE_DOMAIN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;