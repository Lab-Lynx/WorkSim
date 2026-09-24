import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requirePaidAccess } from '../middleware/subscription.middleware';
import { requireGitHubConnection } from '../middleware/github.middleware';
import { validate } from '../middleware/validate.middleware';
import { createStarterRepoSchema } from '../validators/github.validators';
import {
  connect,
  callback,
  getConnection,
  disconnect,
  createRepo,
} from '../controllers/github.controller';

const router = Router();

// EP-18: auth + paid access
router.get('/connect', requireAuth, requirePaidAccess, connect);

// EP-19: GitHub redirects the browser here directly. requireAuth confirms
// a logged-in session exists (the login cookie must survive the redirect —
// depends on Q-12's SameSite setting). The OAuth `state` string itself is
// NOT checked by middleware — it's validated inside handleGitHubCallback,
// because that check needs the decoded userId to compare against req.user.id.
router.get('/callback', requireAuth, callback);

// EP-20: auth only — read-only, available even with a lapsed subscription
router.get('/connection', requireAuth, getConnection);

// EP-21: auth only
router.delete('/connection', requireAuth, disconnect);

// EP-22: auth + paid access + GitHub connection, THEN validate the body.
// Validation runs last so a request that fails an earlier gate (e.g. no
// subscription) gets that specific error instead of a generic 400 first.
router.post(
  '/repo',
  requireAuth,
  requirePaidAccess,
  requireGitHubConnection,
  validate(createStarterRepoSchema),
  createRepo,
);

export default router;
