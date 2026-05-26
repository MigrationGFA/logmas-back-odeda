// users.routes.ts
import { Router } from 'express';
import { createUser, getUsers, getUserById, updateUser, softDeleteUser } from './users.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';

const router = Router();
router.use(requireAuth, requireRole('super_admin', 'lga_admin'));

router.post('/', createUser);
router.get('/', getUsers);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.delete('/:id', softDeleteUser);

export default router;