// auth.routes.ts
import { Router } from 'express';
import { login, register, getMe } from './auth.controller';
import { validateBody } from '../../middleware/validate.middleware';
import { requireAuth } from '../../middleware/auth.middleware';
import { registerSchema, loginSchema } from './auth.validation';

const router = Router();
router.post('/register', validateBody(registerSchema), register);
router.post('/login', validateBody(loginSchema), login);
router.get('/me', requireAuth, getMe);

export default router;