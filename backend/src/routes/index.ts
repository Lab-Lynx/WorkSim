import { Router } from 'express';
import authRouter from './auth.routes.js';
import userRouter from './user.routes.js';
import ticketRouter from './ticket.routes.js';
import mentorRouter from './mentor.routes.js';
import submissionRouter from './submission.routes.js';
import profileRouter from './profile.routes.js';
import webhookRouter from './webhook.routes.js';
import githubRouter from './github.routes.js';
import subscriptionRouter from './subscription.routes.js';
import paymentRouter from './payment.routes.js';

const router = Router();

// Doc 7 §7.9 Phase 9 Item 80 — Route registrations under /api/v1 prefix:
// Existing routers:
router.use('/auth', authRouter);
router.use('/users', userRouter);
router.use('/tickets', ticketRouter);
router.use('/tickets', mentorRouter);
router.use('/tickets', submissionRouter);
router.use('/profile', profileRouter);
router.use('/webhooks', webhookRouter);
router.use('/github', githubRouter);
router.use('/subscriptions', subscriptionRouter);
router.use('/payments', paymentRouter);

export default router;

