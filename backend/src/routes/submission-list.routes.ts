import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import * as submissionController from '../controllers/submission.controller.js';

const router = Router();

/** EP-35 — GET /submissions (authenticated; read stays open after a paid lapse). */
router.get('/', authMiddleware, submissionController.listSubmissions);

export default router;
