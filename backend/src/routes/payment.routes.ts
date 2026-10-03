import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getPayments } from '../controllers/payment.controller';

const router = Router();

// EP-17: payment history — auth only, no requirePaidAccess. Same reasoning
// as the subscription routes: this is read-only account history, so it
// stays available even to a user whose subscription has lapsed.
router.get('/', requireAuth, getPayments);

export default router;
