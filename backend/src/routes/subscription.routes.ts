import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import * as subscriptionController from '../controllers/subscription.controller.js';

const router = Router();

router.post('/checkout', authMiddleware, subscriptionController.startCheckout);
router.get('/me', authMiddleware, subscriptionController.getSubscription);
router.post('/cancel', authMiddleware, subscriptionController.cancelSubscription);

export default router;
