// wards.routes.ts
import { Router } from 'express';
import { createWard, getWards, updateWard, softDeleteWard } from './wards.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';

const router = Router();
router.get('/', requireAuth, getWards);
router.post('/', requireAuth, requireRole('super_admin', 'lga_admin'), createWard);
router.put('/:id', requireAuth, requireRole('super_admin', 'lga_admin'), updateWard);
router.delete('/:id', requireAuth, requireRole('super_admin', 'lga_admin'), softDeleteWard);

export default router;