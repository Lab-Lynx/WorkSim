import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import type { IncomingMessage } from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Utilities & Configs
import { env } from './config/env.js';
import logger from './utils/logger.js';
import ApiError from './utils/ApiError.js';
import { SuccessResponse } from './utils/ApiResponse.js';
import { HTTP_STATUS } from './constants/index.js';

// Middlewares & Routes
import { defaultLimiter } from './middlewares/rateLimiter.middleware.js';
import csrfMiddleware from './middlewares/csrf.middleware.js';
import errorMiddleware from './middlewares/error.middleware.js';
import router from './routes/index.js';
import { httpMetricsMiddleware, metricsHandler } from './lib/observability/metrics.js';

const app = express();

// Generate a correlation ID for each request
app.use((req, res, next) => {
  req.id = randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// Attach the request ID to Pino logs
app.use(pinoHttp({
  logger,
  genReqId: (req: IncomingMessage) => (typeof req.id === 'string' ? req.id : randomUUID()),
}));

app.use(httpMetricsMiddleware);

// 🛡️ Security Middlewares
app.use(helmet());

// Token-protected Prometheus scrape endpoint; returns 404 unless METRICS_TOKEN is set.
// Registered ahead of the rate limiter so scrapes are never throttled.
app.get('/metrics', metricsHandler);
app.use(
  cors({
    // credentials:true cannot pair with a wildcard "*" origin — the browser
    // rejects that combination outright, which would silently break the
    // httpOnly auth cookies. CLIENT_URL must be the frontend's exact origin
    // in every environment, dev included.
    origin: env.CLIENT_URL,
    credentials: true,
  })
);
app.use(defaultLimiter);

// 📦 Body Parsing Configurations
// Doc 7 §7.2.9, §7.8; doc 7 §7.9 items 83–84:
// Webhook routes (EP-14: Chapa, EP-33: GitHub) must receive the raw request body
// ahead of express.json() so cryptographic signature verification (HMAC-SHA256)
// operates on the untouched byte stream.
// Webhook controllers receive the preserved bytes for signature verification.
export const WEBHOOK_PATHS = [
  '/api/v1/webhooks/chapa',
  '/api/v1/webhooks/github',
  '/webhooks/chapa',
  '/webhooks/github',
];

app.use(
  WEBHOOK_PATHS,
  express.raw({ type: '*/*', limit: '1mb' }),
  (req, _res, next) => {
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body;
    }
    next();
  }
);

// Standard JSON body parsing for all other routes
app.use(
  express.json({
    limit: '10kb',
    verify: (req, _res, buf) => {
      (req as express.Request).rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
app.use(csrfMiddleware);

// 🚀 Core Application Routing Paths
app.use('/api/v1', router);

// Health check
app.get('/health', (req, res) => {
  return res
    .status(HTTP_STATUS.OK)
    .json(new SuccessResponse(HTTP_STATUS.OK, 'Server is running healthily', { status: 'ok' }));
});

// 📦 Serve frontend static files in production
// The frontend is built and output to the WorkSim/frontend/dist directory
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));

// 🔄 SPA fallback: serve index.html for all non-API routes
// This ensures client-side routing works properly
// Must come AFTER static file serving and API routes
app.use((req, res, next) => {
  // Skip if this is an API request or a direct file request
  if (
    req.path.startsWith('/api/') ||
    req.path.startsWith('/webhooks/') ||
    req.path === '/health' ||
    req.path === '/metrics'
  ) {
    return next();
  }
  // For all other routes, serve the frontend index.html
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// 🔍 404 Route Catch-All Handling
app.use((req, res, next) => {
  next(new ApiError(HTTP_STATUS.NOT_FOUND, `Route ${req.method} ${req.path} not found`));
});

// 🛡️ Global Unified Error Interceptor Pipeline
app.use(errorMiddleware);

export default app;
