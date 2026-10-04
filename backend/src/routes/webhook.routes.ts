import { Router } from 'express';
import { receiveChapaWebhook, receiveGitHubWebhook } from '../controllers/webhook.controller.js';

const router = Router();

router.post('/chapa', receiveChapaWebhook);
router.post('/github', receiveGitHubWebhook);

export default router;
