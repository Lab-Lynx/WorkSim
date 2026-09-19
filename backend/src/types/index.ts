import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

declare global {
  namespace Express {
    interface Request {
      id: string;
      // Set by validate.middleware.ts when a route's schema includes a
      // `query` shape. See the comment there for why this isn't just
      // written back onto `req.query` (Express 5: getter-only).
      validatedQuery?: Record<string, unknown>;
    }
  }
}