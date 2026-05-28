"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/contractor/contractor.routes.ts
const express_1 = require("express");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const authorize_middleware_1 = require("../../middleware/authorize.middleware");
const contractor_controller_1 = require("./contractor.controller");
const router = (0, express_1.Router)();
// Contractor and agent share the same monitoring access
const guard = [auth_middleware_1.requireAuth, (0, authorize_middleware_1.requireRole)('contractor', 'agent')];
/**
 * @openapi
 * /contractor/summary:
 *   get:
 *     tags: [Contractor]
 *     summary: Aggregated revenue summary across all assigned officers
 *     security:
 *       - BearerAuth: []
 */
router.get('/summary', ...guard, contractor_controller_1.getContractorSummary);
/**
 * @openapi
 * /contractor/officers:
 *   get:
 *     tags: [Contractor]
 *     summary: List all field officers assigned to this contractor
 *     security:
 *       - BearerAuth: []
 */
router.get('/officers', ...guard, contractor_controller_1.getMyOfficers);
/**
 * @openapi
 * /contractor/officers/{officerId}/collections:
 *   get:
 *     tags: [Contractor]
 *     summary: View a specific officer's daily collection activity
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: officerId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by date YYYY-MM-DD. Defaults to today.
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 */
router.get('/officers/:officerId/collections', ...guard, contractor_controller_1.getOfficerCollections);
exports.default = router;
