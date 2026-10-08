import * as Sentry from '@sentry/node';
import type { ErrorEvent } from '@sentry/node';
import { env } from '../../config/env.js';
import ApiError from '../../utils/ApiError.js';

const SENSITIVE_HEADERS = ['cookie', 'authorization', 'set-cookie', 'x-api-key', 'x-chapa-signature', 'x-hub-signature-256'];

/**
 * Strips anything that could carry credentials or user content before an event leaves the process.
 * Exported so the scrubbing rules can be tested without a Sentry connection.
 */
export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
    if (event.request.headers) {
      for (const header of Object.keys(event.request.headers)) {
        if (SENSITIVE_HEADERS.includes(header.toLowerCase())) {
          delete event.request.headers[header];
        }
      }
    }
  }
  delete event.user;
  return event;
}

let initialized = false;

export function initSentry(): void {
  if (initialized || !env.SENTRY_DSN) return;

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    beforeSend: scrubSentryEvent,
  });
  initialized = true;
}

/** Operational ApiErrors below 500 are expected outcomes (validation, auth), not bugs. */
export function shouldReportError(err: unknown): boolean {
  if (err instanceof ApiError) return err.statusCode >= 500;
  return true;
}

export function captureServerError(err: unknown, context?: { requestId?: string; route?: string }): void {
  if (!initialized || !shouldReportError(err)) return;
  Sentry.withScope((scope) => {
    if (context?.requestId) scope.setTag('request_id', context.requestId);
    if (context?.route) scope.setTag('route', context.route);
    Sentry.captureException(err);
  });
}

/** Gives queued events a chance to send before the process exits. */
export async function flushSentry(timeoutMs = 2_000): Promise<void> {
  if (!initialized) return;
  await Sentry.flush(timeoutMs);
}
