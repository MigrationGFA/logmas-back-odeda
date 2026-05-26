// permits.routes.ts
import { Router } from 'express';
import { createPermitApplication, issuePermit, getPermits, verifyPermitByToken } from './permits.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';

const router = Router();
router.get('/verify/:token', verifyPermitByToken);
router.post('/', requireAuth, createPermitApplication);
router.get('/', requireAuth, requireRole('super_admin', 'lga_admin', 'chairman'), getPermits);
router.patch('/:id/issue', requireAuth, requireRole('super_admin', 'lga_admin'), issuePermit);

export default router;