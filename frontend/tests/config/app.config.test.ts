import { describe, expect, it } from 'vitest';
import {
  API_BASE_PATH,
  CHECKOUT_POLL_INTERVAL_MS,
  CHECKOUT_POLL_MAX_MS,
  COPY_FEEDBACK_MS,
  ME_STALE_TIME_MS,
  MENTOR_MESSAGE_MAX_CHARS,
  REQUEST_TIMEOUT_DEFAULT_MS,
  REQUEST_TIMEOUT_LONG_MS,
  RESEND_COOLDOWN_MS,
  SUBMISSION_POLL_FAST_MS,
  SUBMISSION_POLL_SLOW_MS,
  SUBMISSION_POLL_SLOW_AFTER_MS,
  SUBMISSION_POLL_STOP_AFTER_MS,
  TICKET_DONE_SYNC_INTERVAL_MS,
  TICKET_DONE_SYNC_MAX_ATTEMPTS,
} from '@/config/app.config';

describe('app configuration', () => {
  it('matches the documented API and request timing values', () => {
    expect(API_BASE_PATH).toBe('/api/v1');
    expect(REQUEST_TIMEOUT_DEFAULT_MS).toBe(30_000);
    expect(REQUEST_TIMEOUT_LONG_MS).toBe(60_000);
    expect(CHECKOUT_POLL_INTERVAL_MS).toBe(2_000);
    expect(CHECKOUT_POLL_MAX_MS).toBe(60_000);
  });

  it('matches the documented submission, cooldown, cache, and sync values', () => {
    expect(SUBMISSION_POLL_FAST_MS).toBe(3_000);
    expect(SUBMISSION_POLL_SLOW_MS).toBe(10_000);
    expect(SUBMISSION_POLL_SLOW_AFTER_MS).toBe(120_000);
    expect(SUBMISSION_POLL_STOP_AFTER_MS).toBe(600_000);
    expect(RESEND_COOLDOWN_MS).toBe(60_000);
    expect(TICKET_DONE_SYNC_INTERVAL_MS).toBe(2_000);
    expect(TICKET_DONE_SYNC_MAX_ATTEMPTS).toBe(3);
    expect(ME_STALE_TIME_MS).toBe(300_000);
    expect(COPY_FEEDBACK_MS).toBe(2_000);
  });

  it('keeps the unanswered mentor limit unset', () => {
    const maxChars: number | null = MENTOR_MESSAGE_MAX_CHARS;

    expect(maxChars).toBeNull();
  });
});
