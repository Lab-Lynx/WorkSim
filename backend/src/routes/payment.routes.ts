import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import * as paymentController from '../controllers/payment.controller.js';

const router = Router();

router.get('/', authMiddleware, paymentController.getPayments);

export default router;
