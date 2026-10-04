import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

class EnvironmentConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentConfigurationError';
    Object.setPrototypeOf(this, EnvironmentConfigurationError.prototype);
  }
}

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
  GITHUB_REQUESTED_SCOPE: z.literal('write:repo_hook').default('write:repo_hook'),
  GITHUB_WEBHOOK_SECRET: z.string().min(1),

  GEMINI_API_KEY: z.string().min(1),
  GROQ_API_KEY: z.string().min(1),
  // Pending team decision: provider model names remain deployment-configurable.
  GEMINI_MODEL: z.string().min(1).default('gemini-1.5-flash'),
  GROQ_MODEL: z.string().min(1).default('llama-3.3-70b-versatile'),
  GEMINI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
  GROQ_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
  GEMINI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  GROQ_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),

  MENTOR_MESSAGE_MAX_CHARS: z.coerce.number().int().positive().default(4_000),
  MENTOR_MESSAGES_PER_TICKET: z.coerce.number().int().positive().default(20),
  MENTOR_MESSAGE_WINDOW_MS: z.coerce.number().int().positive().default(86_400_000),
  VERIFICATION_TOKEN_EXPIRES_IN: z.string().min(1).optional(),
  PASSWORD_RESET_TOKEN_EXPIRES_IN: z.string().min(1).optional(),
  // Pending team decision (Q-13): submission timeout values remain configurable.
  SUBMISSION_CI_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  SUBMISSION_EVALUATOR_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  DIFF_MAX_BYTES: z.coerce.number().int().positive().default(1_048_576),
  AI_TICKET_MAX_INPUT_BYTES: z.coerce.number().int().positive().default(2_000_000),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  DEFAULT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  DEFAULT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  REGISTRATION_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(3_600_000),
  REGISTRATION_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  COST_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  COST_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  MENTOR_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
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
    throw new EnvironmentConfigurationError(`Invalid environment variables: ${fields}`);
  }

  return parsed.data;
}

// Throwing here makes the server fail before it starts listening, without exposing values.
export const env = loadEnv(process.env);
