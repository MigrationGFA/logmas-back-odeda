"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/lgaAdmin/lgaAdmin.routes.ts
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const authorize_middleware_1 = require("../../middleware/authorize.middleware");
const validate_middleware_1 = require("../../middleware/validate.middleware");
const lgaAdmin_controller_1 = require("./lgaAdmin.controller");
const lgaAdmin_validation_1 = require("./lgaAdmin.validation");
const router = (0, express_1.Router)();
// Both lga_admin and super_admin can access all these routes
const guard = [auth_middleware_1.requireAuth, (0, authorize_middleware_1.requireRole)('lga_admin', 'super_admin')];
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
router.get('/overview', ...guard, lgaAdmin_controller_1.getAdminOverview);
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
router.post('/wards', ...guard, (0, validate_middleware_1.validateBody)(lgaAdmin_validation_1.createWardSchema), lgaAdmin_controller_1.createWard);
/**
 * @openapi
 * /lga-admin/wards:
 *   get:
 *     tags: [LGA Admin]
 *     summary: List all wards with councillor info and counts
 *     security:
 *       - BearerAuth: []
 */
router.get('/wards', ...guard, (0, validate_middleware_1.validateQuery)(lgaAdmin_validation_1.listWardsSchema), lgaAdmin_controller_1.listWards);
/**
 * @openapi
 * /lga-admin/wards/{id}:
 *   get:
 *     tags: [LGA Admin]
 *     summary: Get a single ward with full detail
 *     security:
 *       - BearerAuth: []
 */
router.get('/wards/:id', ...guard, lgaAdmin_controller_1.getWardById);
/**
 * @openapi
 * /lga-admin/wards/{id}:
 *   patch:
 *     tags: [LGA Admin]
 *     summary: Update ward details
 *     security:
 *       - BearerAuth: []
 */
router.patch('/wards/:id', ...guard, (0, validate_middleware_1.validateBody)(lgaAdmin_validation_1.updateWardSchema), lgaAdmin_controller_1.updateWard);
/**
 * @openapi
 * /lga-admin/wards/{id}/assign-councillor:
 *   patch:
 *     tags: [LGA Admin]
 *     summary: Assign a ward councillor to this ward
 *     security:
 *       - BearerAuth: []
 */
router.patch('/wards/:id/assign-councillor', ...guard, (0, validate_middleware_1.validateBody)(lgaAdmin_validation_1.assignCouncillorSchema), lgaAdmin_controller_1.assignCouncillor);
/**
 * @openapi
 * /lga-admin/wards/{id}:
 *   delete:
 *     tags: [LGA Admin]
 *     summary: Soft delete a ward
 *     security:
 *       - BearerAuth: []
 */
router.delete('/wards/:id', ...guard, lgaAdmin_controller_1.deleteWard);
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
router.post('/staff', ...guard, (0, validate_middleware_1.validateBody)(lgaAdmin_validation_1.createStaffSchema), lgaAdmin_controller_1.createStaff);
/**
 * @openapi
 * /lga-admin/staff:
 *   get:
 *     tags: [LGA Admin]
 *     summary: List all staff — filterable by role, ward, and active status
 *     security:
 *       - BearerAuth: []
 */
router.get('/staff', ...guard, (0, validate_middleware_1.validateQuery)(lgaAdmin_validation_1.listStaffSchema), lgaAdmin_controller_1.listStaff);
/**
 * @openapi
 * /lga-admin/staff/{id}:
 *   get:
 *     tags: [LGA Admin]
 *     summary: Get a single staff member with full profile
 *     security:
 *       - BearerAuth: []
 */
router.get('/staff/:id', ...guard, lgaAdmin_controller_1.getStaffById);
/**
 * @openapi
 * /lga-admin/staff/{id}:
 *   patch:
 *     tags: [LGA Admin]
 *     summary: Update staff profile or reassign ward/contractor
 *     security:
 *       - BearerAuth: []
 */
router.patch('/staff/:id', ...guard, (0, validate_middleware_1.validateBody)(lgaAdmin_validation_1.updateStaffSchema), lgaAdmin_controller_1.updateStaff);
/**
 * @openapi
 * /lga-admin/staff/{id}/toggle-status:
 *   patch:
 *     tags: [LGA Admin]
 *     summary: Activate or suspend a staff account
 *     security:
 *       - BearerAuth: []
 */
router.patch('/staff/:id/toggle-status', ...guard, lgaAdmin_controller_1.toggleStaffStatus);
exports.default = router;
