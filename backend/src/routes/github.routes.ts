import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import { requirePaidAccess } from '../middlewares/subscription.middleware.js';
import { requireGitHubConnection } from '../middlewares/github.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { createStarterRepoSchema } from '../validators/github.validators.js';
import * as githubController from '../controllers/github.controller.js';

const router = Router();

// EP-18: auth + paid access
router.get('/connect', authMiddleware, requirePaidAccess, githubController.connect);

// EP-19: OAuth callback
router.get('/callback', authMiddleware, githubController.callback);

// EP-20: GitHub connection summary
router.get('/connection', authMiddleware, githubController.getConnection);

// EP-21: Disconnect GitHub
router.delete('/connection', authMiddleware, githubController.disconnect);

// EP-22: Create starter repo
router.post(
  '/repo',
  authMiddleware,
  requirePaidAccess,
  requireGitHubConnection,
  validate(createStarterRepoSchema),
  githubController.createRepo,
);

export default router;
