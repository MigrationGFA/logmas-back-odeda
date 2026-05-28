// src/modules/lgaAdmin/lgaAdmin.routes.ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/authorize.middleware';
import { validateBody, validateQuery } from '../../middleware/validate.middleware';
import {
  createWard, listWards, getWardById, updateWard,
  assignCouncillor, deleteWard,
  createStaff, listStaff, getStaffById, updateStaff, toggleStaffStatus,
  getAdminOverview,
} from './lgaAdmin.controller';
import {
  createWardSchema, updateWardSchema, assignCouncillorSchema,
  createStaffSchema, updateStaffSchema,
  listStaffSchema, listWardsSchema,
} from './lgaAdmin.validation';

const router = Router();

// Both lga_admin and super_admin can access all these routes
const guard = [requireAuth, requireRole('lga_admin', 'super_admin')];

// ── OVERVIEW ──────────────────────────────────────────────────

/**
 * @openapi
 * /lga-admin/overview:
 *   get:
 *     tags: [LGA Admin]
 *     summary: Dashboard overview — ward, staff, application and complaint stats
 *     security:
 *       - BearerAuth: []
 */
router.get('/overview', ...guard, getAdminOverview);

// ── WARDS ─────────────────────────────────────────────────────

/**
 * @openapi
 * /lga-admin/wards:
 *   post:
 *     tags: [LGA Admin]
 *     summary: Create a new ward
 *     security:
 *       - BearerAuth: []
 */
router.post('/wards', ...guard, validateBody(createWardSchema), createWard);

/**
 * @openapi
 * /lga-admin/wards:
 *   get:
 *     tags: [LGA Admin]
 *     summary: List all wards with councillor info and counts
 *     security:
 *       - BearerAuth: []
 */
router.get('/wards', ...guard, validateQuery(listWardsSchema), listWards);

/**
 * @openapi
 * /lga-admin/wards/{id}:
 *   get:
 *     tags: [LGA Admin]
 *     summary: Get a single ward with full detail
 *     security:
 *       - BearerAuth: []
 */
router.get('/wards/:id', ...guard, getWardById);

/**
 * @openapi
 * /lga-admin/wards/{id}:
 *   patch:
 *     tags: [LGA Admin]
 *     summary: Update ward details
 *     security:
 *       - BearerAuth: []
 */
router.patch('/wards/:id', ...guard, validateBody(updateWardSchema), updateWard);

/**
 * @openapi
 * /lga-admin/wards/{id}/assign-councillor:
 *   patch:
 *     tags: [LGA Admin]
 *     summary: Assign a ward councillor to this ward
 *     security:
 *       - BearerAuth: []
 */
router.patch(
  '/wards/:id/assign-councillor',
  ...guard,
  validateBody(assignCouncillorSchema),
  assignCouncillor
);

/**
 * @openapi
 * /lga-admin/wards/{id}:
 *   delete:
 *     tags: [LGA Admin]
 *     summary: Soft delete a ward
 *     security:
 *       - BearerAuth: []
 */
router.delete('/wards/:id', ...guard, deleteWard);

// ── STAFF ─────────────────────────────────────────────────────

/**
 * @openapi
 * /lga-admin/staff:
 *   post:
 *     tags: [LGA Admin]
 *     summary: Create a new staff account with a generated temporary password
 *     security:
 *       - BearerAuth: []
 */
router.post('/staff', ...guard, validateBody(createStaffSchema), createStaff);

/**
 * @openapi
 * /lga-admin/staff:
 *   get:
 *     tags: [LGA Admin]
 *     summary: List all staff — filterable by role, ward, and active status
 *     security:
 *       - BearerAuth: []
 */
router.get('/staff', ...guard, validateQuery(listStaffSchema), listStaff);

/**
 * @openapi
 * /lga-admin/staff/{id}:
 *   get:
 *     tags: [LGA Admin]
 *     summary: Get a single staff member with full profile
 *     security:
 *       - BearerAuth: []
 */
router.get('/staff/:id', ...guard, getStaffById);

/**
 * @openapi
 * /lga-admin/staff/{id}:
 *   patch:
 *     tags: [LGA Admin]
 *     summary: Update staff profile or reassign ward/contractor
 *     security:
 *       - BearerAuth: []
 */
router.patch('/staff/:id', ...guard, validateBody(updateStaffSchema), updateStaff);

/**
 * @openapi
 * /lga-admin/staff/{id}/toggle-status:
 *   patch:
 *     tags: [LGA Admin]
 *     summary: Activate or suspend a staff account
 *     security:
 *       - BearerAuth: []
 */
router.patch('/staff/:id/toggle-status', ...guard, toggleStaffStatus);

export default router;