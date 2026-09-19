import { Router } from 'express';
import authRouter from './auth.routes.js';

const router = Router();

router.use('/auth', authRouter);

// register your other routes here
// example: router.use('/users', usersRouter);

export default router;
