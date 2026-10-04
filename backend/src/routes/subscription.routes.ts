import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import * as subscriptionController from '../controllers/subscription.controller.js';

const router = Router();

// EP-13: start a checkout
router.post('/checkout', authMiddleware, subscriptionController.startCheckout);

// EP-15: read-only status check
router.get('/me', authMiddleware, subscriptionController.getSubscription);

// EP-16: cancel subscription
router.post('/cancel', authMiddleware, subscriptionController.cancelSubscription);

export default router;
