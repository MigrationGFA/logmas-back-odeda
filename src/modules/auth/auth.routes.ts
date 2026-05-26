// auth.routes.ts
import { Router } from 'express';
import { login, register, getMe, googleLogin, refreshToken } from './auth.controller';
import { validateBody } from '../../middleware/validate.middleware';
import { requireAuth } from '../../middleware/auth.middleware';
import { registerSchema, loginSchema, googleAuthSchema } from './auth.validation';

const router = Router();
router.post('/register', validateBody(registerSchema), register);
router.post('/login', validateBody(loginSchema), login);
router.post('/google', validateBody(googleAuthSchema), googleLogin);
router.get('/me', requireAuth, getMe);
router.post('/refresh', refreshToken);


export default router;