import { Router } from 'express';
import validate from '../middlewares/validate.middleware.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import { updateDisplayNameSchema } from '../validators/user.validators.js';
import * as userController from '../controllers/user.controller.js';

const router = Router();

router.get('/me', authMiddleware, userController.getMe);
router.patch('/me', authMiddleware, validate(updateDisplayNameSchema), userController.updateMe);

export default router;
