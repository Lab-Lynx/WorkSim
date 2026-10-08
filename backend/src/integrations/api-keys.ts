/**
 * Builds an ordered, de-duplicated list of API keys to try for one AI operation.
 * Unset or blank entries are skipped, so a deployment with a single key behaves exactly as before.
 */
export const collectApiKeys = (...candidates: Array<string | undefined>): string[] => {
  const keys: string[] = [];
  for (const candidate of candidates) {
    const key = candidate?.trim();
    if (key && !keys.includes(key)) keys.push(key);
  }
  return keys;
};

const DEFAULT_COOLDOWN_MS = 60_000;
const MAX_COOLDOWN_MS = 15 * 60_000;

// In-memory only: keys are never logged or persisted, and a restart simply forgets the cooldowns.
const cooldownUntil = new Map<string, number>();

/**
 * Puts keys that recently reported exhaustion behind healthy ones. Nothing is dropped, so if every
 * key is cooling down they are all still tried, in the original order.
 */
export const orderKeysByAvailability = (keys: string[], now: number = Date.now()): string[] => {
  const available = keys.filter((key) => (cooldownUntil.get(key) ?? 0) <= now);
  const cooling = keys.filter((key) => (cooldownUntil.get(key) ?? 0) > now);
  return [...available, ...cooling];
};

/** Remembers that a key just reported exhaustion so the next requests try other keys first. */
export const markKeyExhausted = (
  key: string,
  retryAfterMs?: number,
  now: number = Date.now(),
): void => {
  const requested = retryAfterMs && retryAfterMs > 0 ? retryAfterMs : DEFAULT_COOLDOWN_MS;
  cooldownUntil.set(key, now + Math.min(requested, MAX_COOLDOWN_MS));
};

export const resetKeyCooldowns = (): void => {
  cooldownUntil.clear();
};

/** Reads a numeric `Retry-After` header (seconds) into milliseconds; ignores missing or non-numeric values. */
export const parseRetryAfterMs = (
  headers: { get(name: string): string | null } | undefined,
): number | undefined => {
  const raw = headers?.get?.('retry-after');
  if (!raw) return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : undefined;
};

const QUOTA_MESSAGE_PATTERN = /quota|resource[_\s-]?exhausted|rate[_\s-]?limit|too many requests|limit (has been )?(reached|exceeded)/i;

/**
 * Providers sometimes report an exhausted key with a non-429 status (for example 403 or 400).
 * The message is already length-capped and redacted by the caller.
 */
export const isQuotaExhaustionMessage = (message: string): boolean =>
  QUOTA_MESSAGE_PATTERN.test(message);
