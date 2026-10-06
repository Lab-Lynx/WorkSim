import { mapApiError } from '@/lib/api/errors';

const LEAKS_INTERNALS = /^Route\s+[A-Z]+\s+\//i;

/**
 * Message safe to show users: hides server internals, route names and 5xx details
 * behind the caller's fallback.
 */
export function friendlyMessage(error: unknown, fallback: string): string {
  const mapped = mapApiError(error);
  const message = mapped.message;
  if (!message) return fallback;
  if (LEAKS_INTERNALS.test(message) || message.includes('/api/')) return fallback;
  if (typeof mapped.status === 'number' && mapped.status >= 500) return fallback;
  return message;
}
