// src/modules/stateOfOrigin/stateOfOrigin.routes.ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/authorize.middleware';
import { validateBody, validateQuery } from '../../middleware/validate.middleware';
import {
  submitApplication,
  getMyApplications,
  getMyApplicationById,
  getAllApplications,
  getApplicationById,
  forwardToCouncillor,
  getCouncillorQueue,
  decideonApplication,
  verifyCertificate,
} from './stateOfOrigin.controller';
import {
  submitApplicationSchema,
  reviewApplicationSchema,
  councillorDecisionSchema,
  listApplicationsSchema,
} from './stateOfOrigin.validation';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: State of Origin
 *     description: Certificate application and approval flow
 */


// ── PUBLIC (no auth) ─────────────────────────────────────────
router.get('/verify/:code', verifyCertificate);

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
router.post(
  '/',
  requireAuth,
  requireRole('citizen'),
  validateBody(submitApplicationSchema),
  submitApplication
);

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
router.get('/my', requireAuth, requireRole('citizen'), getMyApplications);
router.get('/my/:id', requireAuth, requireRole('citizen'), getMyApplicationById);

// ── WARD COUNCILLOR ───────────────────────────────────────────
router.get(
  '/councillor/queue',
  requireAuth,
  requireRole('ward_councillor'),
  getCouncillorQueue
);
router.patch(
  '/councillor/:id/decide',
  requireAuth,
  requireRole('ward_councillor'),
  validateBody(councillorDecisionSchema),
  decideonApplication
);

// ── LGA ADMIN + SUPER ADMIN ───────────────────────────────────
router.get(
  '/admin',
  requireAuth,
  requireRole('lga_admin', 'super_admin'),
  // validateQuery(listApplicationsSchema),
  getAllApplications
);
router.get(
  '/admin/:id',
  requireAuth,
  requireRole('lga_admin', 'super_admin'),
  getApplicationById
);
router.patch(
  '/admin/:id/forward',
  requireAuth,
  requireRole('lga_admin', 'super_admin'),
  validateBody(reviewApplicationSchema),
  forwardToCouncillor
);

export default router;