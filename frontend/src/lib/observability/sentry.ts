import * as Sentry from '@sentry/react';
import type { ErrorEvent } from '@sentry/react';

// Read straight from import.meta.env: the validated config module throws when VITE_API_URL is
// missing, and error reporting must never be what takes the app (or a test) down.
const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const environment = (import.meta.env.VITE_APP_ENV as string | undefined) ?? import.meta.env.MODE;

// Reset-password and verify-email links carry one-time tokens in the query string.
const stripQuery = (url: string): string => url.split(/[?#]/)[0] ?? url;

/**
 * Removes anything that could carry credentials, one-time tokens or user content before an
 * event leaves the browser. Exported so the rules can be tested without a Sentry connection.
 */
export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    delete event.request.query_string;
    if (event.request.url) event.request.url = stripQuery(event.request.url);
  }
  delete event.user;

  event.breadcrumbs = event.breadcrumbs?.map((breadcrumb) => {
    const data = breadcrumb.data;
    if (!data) return breadcrumb;
    const cleaned = { ...data };
    for (const key of ['url', 'from', 'to'] as const) {
      if (typeof cleaned[key] === 'string') cleaned[key] = stripQuery(cleaned[key]);
    }
    return { ...breadcrumb, data: cleaned };
  });

  return event;
}

let initialized = false;

export function initSentry(): void {
  if (initialized || !dsn) return;

  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: 0,
    beforeSend: scrubSentryEvent,
  });
  initialized = true;
}

export function captureClientError(error: unknown, context?: Record<string, string>): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (context) scope.setContext('app', context);
    Sentry.captureException(error);
  });
}
