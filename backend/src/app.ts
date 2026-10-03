import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'crypto';
import type { IncomingMessage } from 'http';

// Utilities & Configs
import { env } from './config/env.js';
import logger from './utils/logger.js';
import ApiError from './utils/ApiError.js';
import { SuccessResponse } from './utils/ApiResponse.js'; // 🟢 For health check alignment
import { HTTP_STATUS } from './constants/index.js';

// Middlewares & Routes
import { defaultLimiter } from './middlewares/rateLimiter.middleware.js';
import csrfMiddleware from './middlewares/csrf.middleware.js';
import errorMiddleware from './middlewares/error.middleware.js';
import router from './routes/index.js';

const app = express();

// 🟢 2. Generate and bind Correlation Request IDs
app.use((req, res, next) => {
  req.id = randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// 🟢 3. Link Express Request IDs directly to Pino logs
app.use(pinoHttp({
  logger,
  genReqId: (req: IncomingMessage) => (typeof req.id === 'string' ? req.id : randomUUID()),
}));

// 🛡️ Security Middlewares
app.use(helmet());
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
// Note: Webhook domain controllers/routes are tracked in BE-033 and pending implementation;
// mounting this raw-body parser ahead of express.json() ensures the untouched buffer is preserved.
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

// 🟢 4. Realignment of Health Check Endpoint to your Design System Shell
app.get('/health', (req, res) => {
  return res
    .status(HTTP_STATUS.OK)
    .json(new SuccessResponse(HTTP_STATUS.OK, 'Server is running healthily', { status: 'ok' }));
});

// 🔍 404 Route Catch-All Handling
app.use((req, res, next) => {
  next(new ApiError(HTTP_STATUS.NOT_FOUND, `Route ${req.method} ${req.path} not found`));
});

// 🛡️ Global Unified Error Interceptor Pipeline
app.use(errorMiddleware);

export default app;