import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/index.js';

// 🟢 Using a generic parameter <T> so TypeScript tracks the specific schema shape dynamically
const validate = <T>(schema: ZodSchema<T>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 🟢 parsedData is now strictly typed to match the schema's shape instead of 'any'
      const parsedData: T = await schema.parseAsync({
        body: req.body,
        params: req.params,
        query: req.query,
      });

      // Asserting type context locally to safely re-assign back to Express request parameters
      const data = parsedData as any;
      if (data.body) req.body = data.body;
      if (data.params) req.params = data.params;
      // Express 5: req.query is a getter-only property on the request
      // prototype — `req.query = data.query` throws ("Cannot set property
      // query of #<IncomingMessage> which has only a getter") the moment a
      // request actually has query params. Store the validated/coerced
      // query separately instead. Read `req.validatedQuery` in controllers
      // when you need it (e.g. numbers coerced from query strings) —
      // `req.query` itself still works for reading raw values.
      if (data.query) req.validatedQuery = data.query;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.issues.map((issue) => {
          const path = issue.path.join('.');
          return `${path}: ${issue.message}`;
        });

        return next(
          new ApiError(HTTP_STATUS.BAD_REQUEST, 'Validation failed', errorMessages)
        );
      }
      next(error);
    }
  };
};

export default validate;