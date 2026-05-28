"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/stateOfOrigin/stateOfOrigin.routes.ts
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const authorize_middleware_1 = require("../../middleware/authorize.middleware");
const validate_middleware_1 = require("../../middleware/validate.middleware");
const stateOfOrigin_controller_1 = require("./stateOfOrigin.controller");
const stateOfOrigin_validation_1 = require("./stateOfOrigin.validation");
const router = (0, express_1.Router)();
/**
 * @openapi
 * tags:
 *   - name: State of Origin
 *     description: Certificate application and approval flow
 */
// ── PUBLIC (no auth) ─────────────────────────────────────────
router.get('/verify/:code', stateOfOrigin_controller_1.verifyCertificate);
// ── CITIZEN ──────────────────────────────────────────────────
/**
 * @openapi
 * /state-of-origin:
 *   post:
 *     tags: [State of Origin]
 *     summary: Submit a new State of Origin application
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, dateOfBirth, gender, address, phone, wardId]
 *             properties:
 *               fullName:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               gender:
 *                 type: string
 *                 enum: [male, female, other]
 *               address:
 *                 type: string
 *               phone:
 *                 type: string
 *               wardId:
 *                 type: string
 *                 format: uuid
 *               purpose:
 *                 type: string
 *               nin:
 *                 type: string
 *     responses:
 *       201:
 *         description: Application submitted, invoice generated
 *       409:
 *         description: Active application already exists
 */
router.post('/', auth_middleware_1.requireAuth, (0, authorize_middleware_1.requireRole)('citizen'), (0, validate_middleware_1.validateBody)(stateOfOrigin_validation_1.submitApplicationSchema), stateOfOrigin_controller_1.submitApplication);
/**
 * @openapi
 * /state-of-origin/my:
 *   get:
 *     tags: [State of Origin]
 *     summary: Get my applications (citizen)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of citizen's applications
 */
router.get('/my', auth_middleware_1.requireAuth, (0, authorize_middleware_1.requireRole)('citizen'), stateOfOrigin_controller_1.getMyApplications);
router.get('/my/:id', auth_middleware_1.requireAuth, (0, authorize_middleware_1.requireRole)('citizen'), stateOfOrigin_controller_1.getMyApplicationById);
// ── WARD COUNCILLOR ───────────────────────────────────────────
router.get('/councillor/queue', auth_middleware_1.requireAuth, (0, authorize_middleware_1.requireRole)('ward_councillor'), stateOfOrigin_controller_1.getCouncillorQueue);
router.patch('/councillor/:id/decide', auth_middleware_1.requireAuth, (0, authorize_middleware_1.requireRole)('ward_councillor'), (0, validate_middleware_1.validateBody)(stateOfOrigin_validation_1.councillorDecisionSchema), stateOfOrigin_controller_1.decideonApplication);
// ── LGA ADMIN + SUPER ADMIN ───────────────────────────────────
router.get('/admin', auth_middleware_1.requireAuth, (0, authorize_middleware_1.requireRole)('lga_admin', 'super_admin'), (0, validate_middleware_1.validateQuery)(stateOfOrigin_validation_1.listApplicationsSchema), stateOfOrigin_controller_1.getAllApplications);
router.get('/admin/:id', auth_middleware_1.requireAuth, (0, authorize_middleware_1.requireRole)('lga_admin', 'super_admin'), stateOfOrigin_controller_1.getApplicationById);
router.patch('/admin/:id/forward', auth_middleware_1.requireAuth, (0, authorize_middleware_1.requireRole)('lga_admin', 'super_admin'), (0, validate_middleware_1.validateBody)(stateOfOrigin_validation_1.reviewApplicationSchema), stateOfOrigin_controller_1.forwardToCouncillor);
exports.default = router;
