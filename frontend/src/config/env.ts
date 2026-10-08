import { z } from 'zod';
import { ClientConfigurationError } from '@/lib/api/errors';

const envSchema = z.object({
  VITE_API_URL: z.string().url(),
  VITE_APP_NAME: z.string().default('App'),
  VITE_APP_ENV: z.enum(['development', 'production']).default('development'),
  VITE_SENTRY_DSN: z.preprocess((value) => (value === '' ? undefined : value), z.string().url().optional()),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  console.error('Invalid env:', parsed.error.flatten().fieldErrors);
  throw new ClientConfigurationError('Invalid environment variables');
}

export const env = parsed.data;
