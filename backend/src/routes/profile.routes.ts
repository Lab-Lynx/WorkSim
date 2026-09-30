import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import * as profileController from '../controllers/profile.controller.js';

const router = Router();

/** EP-34 — GET /profile (authenticated; no paid-access gate — read stays open after lapse). */
router.get('/', authMiddleware, profileController.getProfile);

export default router;
