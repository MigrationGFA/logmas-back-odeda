import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/authorize.middleware';
import { createCategory, deleteCategory, listCategories, updateCategory } from './revenueCategory.controller';


const router = Router();

// PUBLIC/AUTHENTICATED LAYER: Open to all dashboard active roles
router.get('/', requireAuth, listCategories);

// ENFORCEMENT PRIVILEGE LAYER: Hardlocked explicitly to Super Admins only
router.post(
  '/',
  requireAuth,
  requireRole("super_admin"),
  createCategory
);

router.patch(
    '/:id',
    requireAuth,
    requireRole("super_admin"),
    updateCategory
);

router.delete(
    '/:id',
    requireAuth,
    requireRole("super_admin"),
  deleteCategory
);

export default router;