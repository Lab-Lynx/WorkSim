import { Router } from 'express';
import { handleChapaWebhook } from '../controllers/webhooks/chapa.controller';
import { handleWorkflowRun } from '../controllers/webhooks/github.controller';

const router = Router();

// EP-14 — Chapa payment webhook. No session auth: the signature check
// inside handleChapaWebhook IS the authentication for this route.
router.post('/chapa', handleChapaWebhook);

// EP-33 — GitHub Actions workflow_run webhook. Same reasoning: the
// X-Hub-Signature-256 check inside handleWorkflowRun is the authentication.
router.post('/github', handleWorkflowRun);

export default router;
