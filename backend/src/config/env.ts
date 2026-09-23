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
  CLIENT_URL: z.string().url(),

  CHAPA_SECRET_KEY: z.string().min(1),
  CHAPA_WEBHOOK_SECRET: z.string().min(1),
  CHAPA_RETURN_URL: z.string().url(),
  // Pending team decision: price and currency are intentionally configurable.
  CHAPA_PRICE: z.coerce.number().positive().optional(),
  CHAPA_CURRENCY: z.string().min(3).optional(),

  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_CALLBACK_URL: z.string().url(),
  GITHUB_TOKEN_ENCRYPTION_KEY: z.string().min(1),
  GITHUB_REQUESTED_SCOPE: z.string().default('repo,write:repo_hook'),
  // Pending team decision: this is required when GitHub webhook handling is enabled.
  GITHUB_WEBHOOK_SECRET: z.string().min(1).optional(),

  GEMINI_API_KEY: z.string().min(1),
  GROQ_API_KEY: z.string().min(1),
  // Pending team decision: provider model names remain deployment-configurable.
  GEMINI_MODEL: z.string().min(1).optional(),
  GROQ_MODEL: z.string().min(1).optional(),

  // Pending team decision (Q-10): mentor limits remain unset until product decides them.
  MENTOR_MESSAGE_MAX_CHARS: z.coerce.number().int().positive().optional(),
  MENTOR_MESSAGES_PER_TICKET: z.coerce.number().int().positive().optional(),
  MENTOR_MESSAGE_WINDOW_MS: z.coerce.number().int().positive().optional(),
  VERIFICATION_TOKEN_EXPIRES_IN: z.string().min(1).optional(),
  PASSWORD_RESET_TOKEN_EXPIRES_IN: z.string().min(1).optional(),
  // Pending team decision (Q-13): submission timeout values remain configurable.
  SUBMISSION_CI_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  SUBMISSION_EVALUATOR_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  // Pending team decision: branch naming convention remains configurable.
  BRANCH_NAME_PREFIX: z.string().min(1).optional(),

  // Only needed if frontend and backend share a parent domain in production
  // (e.g. api.example.com / app.example.com) and you want the cookie valid
  // across both. Leave unset for fully separate domains or local dev.
  COOKIE_DOMAIN: z.string().optional(),
});

export type Environment = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, unknown>): Environment {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const fields = Object.keys(parsed.error.flatten().fieldErrors).join(', ');
    throw new Error(`Invalid environment variables: ${fields}`);
  }

  return parsed.data;
}

// Throwing here makes the server fail before it starts listening, without exposing values.
export const env = loadEnv(process.env);
