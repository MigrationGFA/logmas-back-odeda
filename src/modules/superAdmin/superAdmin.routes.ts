// src/modules/superAdmin/superAdmin.routes.ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/authorize.middleware';
import { validateBody, validateQuery } from '../../middleware/validate.middleware';
import {
  createUser, listUsers, getUserById, updateUser,
  toggleUserStatus, resetUserPassword, deleteUser,
  getGlobalAnalytics, getAuditLogs,
} from './superAdmin.controller';
import {
  createUserSchema, updateUserSchema,
  listUsersSchema, dateRangeSchema,
} from './superAdmin.validation';

const router = Router();
const guard  = [requireAuth, requireRole('super_admin')];

// ── USERS ─────────────────────────────────────────────────────

/**
 * @openapi
 * /super-admin/users:
 *   post:
 *     tags: [Super Admin]
 *     summary: Create any user of any role including principal officers
 *     security:
 *       - BearerAuth: []
 */
router.post('/users', ...guard, validateBody(createUserSchema), createUser);

/**
 * @openapi
 * /super-admin/users:
 *   get:
 *     tags: [Super Admin]
 *     summary: List all users — filterable by role, active status, search
 *     security:
 *       - BearerAuth: []
 */
router.get('/users', ...guard, validateQuery(listUsersSchema), listUsers);

/**
 * @openapi
 * /super-admin/users/{id}:
 *   get:
 *     tags: [Super Admin]
 *     summary: Full profile of any user with activity counts
 *     security:
 *       - BearerAuth: []
 */
router.get('/users/:id', ...guard, getUserById);

/**
 * @openapi
 * /super-admin/users/{id}:
 *   patch:
 *     tags: [Super Admin]
 *     summary: Update any user — role, ward, contractor, status
 *     security:
 *       - BearerAuth: []
 */
router.patch('/users/:id', ...guard, validateBody(updateUserSchema), updateUser);

/**
 * @openapi
 * /super-admin/users/{id}/toggle-status:
 *   patch:
 *     tags: [Super Admin]
 *     summary: Activate or suspend any account
 *     security:
 *       - BearerAuth: []
 */
router.patch('/users/:id/toggle-status', ...guard, toggleUserStatus);

/**
 * @openapi
 * /super-admin/users/{id}/reset-password:
 *   patch:
 *     tags: [Super Admin]
 *     summary: Generate a new temporary password for any user
 *     security:
 *       - BearerAuth: []
 */
router.patch('/users/:id/reset-password', ...guard, resetUserPassword);

/**
 * @openapi
 * /super-admin/users/{id}:
 *   delete:
 *     tags: [Super Admin]
 *     summary: Soft delete a user account
 *     security:
 *       - BearerAuth: []
 */
router.delete('/users/:id', ...guard, deleteUser);

// ── ANALYTICS & AUDIT ─────────────────────────────────────────

/**
 * @openapi
 * /super-admin/analytics:
 *   get:
 *     tags: [Super Admin]
 *     summary: Global system analytics — users, revenue, operations, recent activity
 *     security:
 *       - BearerAuth: []
 */
router.get('/analytics', ...guard, validateQuery(dateRangeSchema), getGlobalAnalytics);

/**
 * @openapi
 * /super-admin/audit-logs:
 *   get:
 *     tags: [Super Admin]
 *     summary: Full system audit log
 *     security:
 *       - BearerAuth: []
 */
router.get('/audit-logs', ...guard, getAuditLogs);

export default router;