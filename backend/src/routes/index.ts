import { Router } from 'express';
import authRouter from './auth.routes.js';
import userRouter from './user.routes.js';
import ticketRouter from './ticket.routes.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/users', userRouter);
router.use('/tickets', ticketRouter);

export default router;
