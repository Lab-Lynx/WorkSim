import { Router } from 'express';
import validate from '../middlewares/validate.middleware.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import { requirePaidAccess } from '../middlewares/access.middleware.js';
import {
  getMentorMessagesParamsSchema,
  sendMentorMessageSchema,
} from '../validators/mentor.validators.js';
import * as mentorController from '../controllers/mentor.controller.js';

const router = Router();

/** EP-28 — POST /tickets/:ticketId/mentor/messages (auth + paid access) */
router.post(
  '/:ticketId/mentor/messages',
  authMiddleware,
  requirePaidAccess,
  validate(sendMentorMessageSchema),
  mentorController.sendMessage,
);

/** EP-29 — GET /tickets/:ticketId/mentor/messages (auth only) */
router.get(
  '/:ticketId/mentor/messages',
  authMiddleware,
  validate(getMentorMessagesParamsSchema),
  mentorController.getMessages,
);

export default router;
