// src/modules/contractor/contractor.routes.ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/authorize.middleware';
import {
  getMyOfficers,
  getOfficerCollections,
  getContractorSummary,
} from './contractor.controller';

const router = Router();

// Contractor and agent share the same monitoring access
const guard = [requireAuth, requireRole('contractor', 'agent')];

/**
 * @openapi
 * /contractor/summary:
 *   get:
 *     tags: [Contractor]
 *     summary: Aggregated revenue summary across all assigned officers
 *     security:
 *       - BearerAuth: []
 */
router.get('/summary', ...guard, getContractorSummary);

/**
 * @openapi
 * /contractor/officers:
 *   get:
 *     tags: [Contractor]
 *     summary: List all field officers assigned to this contractor
 *     security:
 *       - BearerAuth: []
 */
router.get('/officers', ...guard, getMyOfficers);

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
router.get('/officers/:officerId/collections', ...guard, getOfficerCollections);

export default router;