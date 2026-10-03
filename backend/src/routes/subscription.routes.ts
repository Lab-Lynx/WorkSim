import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  createCheckout,
  getSubscription,
  cancelSubscription,
} from '../controllers/subscription.controller';

const router = Router();

// EP-13: start a checkout — auth only. Paid-access doesn't apply here,
// since this IS how someone becomes paid; requiring it would be circular.
router.post('/checkout', requireAuth, createCheckout);

// EP-15: read-only status check — always available to a logged-in user,
// even with a lapsed subscription, so they can see why they're locked out.
router.get('/me', requireAuth, getSubscription);

// EP-16: cancel — auth only. A user with NO subscription still needs to
// reach this route to get the correct 409 from the service, rather than
// being blocked at the route level before that message can be returned.
router.post('/cancel', requireAuth, cancelSubscription);

export default router;
