import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import validate from '../middlewares/validate.middleware.js';
import { createRepoSchema } from '../schemas/github.schema.js';
import * as githubController from '../controllers/github.controller.js';

const router = Router();

router.get('/connect', authMiddleware, githubController.connect);
router.get('/callback', githubController.callback);
router.get('/connection', authMiddleware, githubController.getConnection);
router.delete('/connection', authMiddleware, githubController.disconnect);
router.post('/repo', authMiddleware, validate(createRepoSchema), githubController.createRepo);

export default router;

