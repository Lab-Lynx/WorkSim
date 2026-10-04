import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import * as githubController from '../controllers/github.controller.js';

const router = Router();

router.get('/connect', authMiddleware, githubController.connect);
router.get('/callback', githubController.callback);

export default router;
