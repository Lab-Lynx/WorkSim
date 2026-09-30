import { Router } from 'express';
import validate from '../middlewares/validate.middleware.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import {
  requirePaidAccess,
  requireGitHubConnection,
  requireStarterRepo,
} from '../middlewares/access.middleware.js';
import {
  abandonTicketParamsSchema,
  getTicketParamsSchema,
  startTicketParamsSchema,
} from '../validators/ticket.validators.js';
import * as ticketController from '../controllers/ticket.controller.js';

const router = Router();

/** EP-23 — assign next ticket */
router.post(
  '/',
  authMiddleware,
  requirePaidAccess,
  requireGitHubConnection,
  requireStarterRepo,
  ticketController.assignTicket,
);

/** EP-24 — current active ticket */
router.get('/current', authMiddleware, ticketController.currentTicket);

/** EP-25 — get ticket by id */
router.get(
  '/:ticketId',
  authMiddleware,
  validate(getTicketParamsSchema),
  ticketController.getTicket,
);

/** EP-26 — start ticket */
router.post(
  '/:ticketId/start',
  authMiddleware,
  requirePaidAccess,
  validate(startTicketParamsSchema),
  ticketController.startTicket,
);

/** EP-27 — abandon ticket */
router.post(
  '/:ticketId/abandon',
  authMiddleware,
  requirePaidAccess,
  requireGitHubConnection,
  requireStarterRepo,
  validate(abandonTicketParamsSchema),
  ticketController.abandonTicket,
);

export default router;
