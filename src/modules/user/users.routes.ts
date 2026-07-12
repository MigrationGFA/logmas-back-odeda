// users.routes.ts
import { Router } from 'express';
import { createUser, getUsers, getUserById, updateUser, softDeleteUser } from './users.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { updateUserProfile } from '../auth/auth.controller';

const router = Router();
router.use(requireAuth, requireRole('super_admin', 'lga_admin'));

router.post('/', createUser);
router.get('/', getUsers);
router.get('/:id', getUserById);
router.delete('/:id', softDeleteUser);

export default router;