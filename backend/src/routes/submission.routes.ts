import { Router } from 'express';
import validate from '../middlewares/validate.middleware.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import {
  requirePaidAccess,
  requireGitHubConnection,
  requireStarterRepo,
} from '../middlewares/access.middleware.js';
import {
  getSubmissionSchema,
  retrySubmissionParamsSchema,
  submitParamsSchema,
} from '../validators/submission.validators.js';
import * as submissionController from '../controllers/submission.controller.js';

const router = Router();

/** EP-30 — POST /tickets/:ticketId/submissions */
router.post(
  '/:ticketId/submissions',
  authMiddleware,
  requirePaidAccess,
  requireGitHubConnection,
  requireStarterRepo,
  validate(submitParamsSchema),
  submissionController.submit,
);

/** EP-31 — GET /tickets/:ticketId/submissions/:attempt */
router.get(
  '/:ticketId/submissions/:attempt',
  authMiddleware,
  validate(getSubmissionSchema),
  submissionController.getSubmission,
);

/** EP-32 — POST /tickets/:ticketId/submissions/:attempt/retry */
router.post(
  '/:ticketId/submissions/:attempt/retry',
  authMiddleware,
  requirePaidAccess,
  validate(retrySubmissionParamsSchema),
  submissionController.retry,
);

export default router;
