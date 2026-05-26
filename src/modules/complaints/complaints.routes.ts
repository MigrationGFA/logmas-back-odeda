// complaints.routes.ts
import { Router } from 'express';
import { createComplaint, listComplaints, assignComplaint, resolveComplaint } from './complaints.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';

const router = Router();
router.post('/', createComplaint); // Anonymous citizen allowed
router.get('/', requireAuth, requireRole('super_admin', 'lga_admin', 'field_officer'), listComplaints);
router.patch('/:id/assign', requireAuth, requireRole('super_admin', 'lga_admin'), assignComplaint);
router.patch('/:id/resolve', requireAuth, requireRole('super_admin', 'lga_admin', 'field_officer'), resolveComplaint);

export default router;