import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate.middleware';
import { requireAdminKey } from '../middleware/requireAdminKey.middleware';
import {
  createExperienceSchema,
  listExperiencesQuerySchema,
} from '../validators/experience.validators';
import {
  listExperiences,
  getExperience,
  createExperience,
  hideExperience,
} from '../controllers/experience.controller';
import { Request, Response, NextFunction } from 'express';

// Validates req.query specifically. Separate from `validate` since that
// middleware is assumed to target req.body only — confirm with whoever owns
// it, and replace this with validate(schema, 'query') if it already exists.
function validateQuery(schema: typeof listExperiencesQuerySchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        statusCode: 400,
        success: false,
        message: 'Invalid query parameters',
        data: null,
      });
      return;
    }
    req.query = result.data as any;
    next();
  };
}

// Dedicated limiter for the single most abuse-exposed route in the product —
// fully public, fully unauthenticated, honor-system by design. Separate
// from authLimiter per the spec, since this protects a different surface
// for a different reason (spam/abuse, not credential stuffing).
const createExperienceLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    statusCode: 429,
    success: false,
    message: 'Too many submissions from this IP, please try again later',
    data: null,
  },
});

const router = Router();

// EP: list — fully public, no auth, no paid access
router.get('/', validateQuery(listExperiencesQuerySchema), listExperiences);

// EP: single item (share/deep-link) — fully public
router.get('/:id', getExperience);

// EP: create — fully public, but rate-limited and body-validated
router.post('/', createExperienceLimiter, validate(createExperienceSchema), createExperience);

// EP: moderation — gated by the shared admin key, not a session or role
router.delete('/:id', requireAdminKey, hideExperience);

export default router;
