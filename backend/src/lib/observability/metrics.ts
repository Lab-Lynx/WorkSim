import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { env } from '../../config/env.js';

export const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry });

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

const aiRequests = new Counter({
  name: 'ai_requests_total',
  help: 'AI provider calls by outcome',
  labelNames: ['provider', 'operation', 'outcome'] as const,
  registers: [metricsRegistry],
});

const aiTokens = new Counter({
  name: 'ai_tokens_total',
  help: 'AI tokens consumed, for cost estimation',
  labelNames: ['provider', 'operation', 'model', 'direction'] as const,
  registers: [metricsRegistry],
});

const aiKeyFallbacks = new Counter({
  name: 'ai_key_fallbacks_total',
  help: 'Times an AI call moved on to a fallback key',
  labelNames: ['provider', 'cause'] as const,
  registers: [metricsRegistry],
});

// Only the matched route pattern is used as a label, never the raw URL, so ids cannot blow up cardinality.
const routeLabel = (req: Request): string => {
  const pattern = req.route?.path;
  return typeof pattern === 'string' ? `${req.baseUrl}${pattern}` : 'unmatched';
};

export const httpMetricsMiddleware: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const stopTimer = httpRequestDuration.startTimer();
  res.on('finish', () => {
    stopTimer({ method: req.method, route: routeLabel(req), status_code: String(res.statusCode) });
  });
  next();
};

export type AiProvider = 'gemini' | 'groq';
export type AiOperation = 'mentor' | 'ticket_generation' | 'evaluator';

export function recordAiRequest(provider: AiProvider, operation: AiOperation, outcome: string): void {
  aiRequests.inc({ provider, operation, outcome });
}

export function recordAiTokens(
  provider: AiProvider,
  operation: AiOperation,
  model: string,
  usage: { inputTokens?: number; outputTokens?: number },
): void {
  if (usage.inputTokens && usage.inputTokens > 0) {
    aiTokens.inc({ provider, operation, model, direction: 'input' }, usage.inputTokens);
  }
  if (usage.outputTokens && usage.outputTokens > 0) {
    aiTokens.inc({ provider, operation, model, direction: 'output' }, usage.outputTokens);
  }
}

export function recordAiKeyFallback(provider: AiProvider, cause: string): void {
  aiKeyFallbacks.inc({ provider, cause });
}

const tokenMatches = (provided: string, expected: string): boolean => {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/**
 * Prometheus scrape endpoint. Disabled (404) unless METRICS_TOKEN is configured, and
 * otherwise requires that token as a bearer credential so metrics are never public.
 */
export const metricsHandler: RequestHandler = async (req, res) => {
  const expected = env.METRICS_TOKEN;
  if (!expected) {
    res.status(404).json({ success: false, message: 'Not found' });
    return;
  }

  const header = req.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!provided || !tokenMatches(provided, expected)) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  res.set('Content-Type', metricsRegistry.contentType);
  res.send(await metricsRegistry.metrics());
};
