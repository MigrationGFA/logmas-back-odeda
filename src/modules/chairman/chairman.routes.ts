// src/modules/chairman/chairman.routes.ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/authorize.middleware';
import {
  getOverview, 
  getRevenueTrend,
  getWardPerformance, 
  getApplicationStats, 
  getComplaintOverview,
} from './chairman.controller';

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Chairman Dashboard
 *     description: Executive dashboard endpoints for LGA Chairman with high-level KPIs and performance metrics
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     DateRange:
 *       type: object
 *       properties:
 *         from:
 *           type: string
 *           format: date
 *           description: Start date of the reporting period
 *         to:
 *           type: string
 *           format: date
 *           description: End date of the reporting period
 *     
 *     RevenueSummary:
 *       type: object
 *       properties:
 *         totalInvoiced:
 *           type: number
 *           description: Total amount invoiced in the period
 *         totalCollected:
 *           type: number
 *           description: Total amount collected in the period
 *         totalOutstanding:
 *           type: number
 *           description: Outstanding balance
 *         collectionRate:
 *           type: string
 *           description: Collection rate as percentage
 *         totalInvoices:
 *           type: integer
 *     
 *     OperationsSummary:
 *       type: object
 *       properties:
 *         totalBusinesses:
 *           type: integer
 *         totalWards:
 *           type: integer
 *         applications:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *             breakdown:
 *               type: object
 *         complaints:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *             open:
 *               type: integer
 *             breakdown:
 *               type: object
 *         permits:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *             issued:
 *               type: integer
 *             breakdown:
 *               type: object
 *   
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

const guard = [requireAuth, requireRole('chairman', 'super_admin')];

/**
 * @openapi
 * /chairman/overview:
 *   get:
 *     tags: [Chairman Dashboard]
 *     summary: Get executive dashboard overview
 *     description: Top-level KPIs including revenue summary, operational metrics, and real-time status of applications, complaints, and permits. This is the primary dashboard view for LGA Chairman.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering data (defaults to start of current month)
 *         example: "2024-01-01"
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering data (defaults to current date)
 *         example: "2024-12-31"
 *     responses:
 *       200:
 *         description: Dashboard overview retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     period:
 *                       $ref: '#/components/schemas/DateRange'
 *                     revenue:
 *                       $ref: '#/components/schemas/RevenueSummary'
 *                     operations:
 *                       $ref: '#/components/schemas/OperationsSummary'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Requires chairman or super_admin role
 *       500:
 *         description: Internal server error
 */
router.get('/overview', ...guard, getOverview);

/**
 * @openapi
 * /chairman/revenue:
 *   get:
 *     tags: [Chairman Dashboard]
 *     summary: Get revenue trend analysis
 *     description: Detailed revenue analytics showing revenue breakdown by category and daily collection trends for the executive dashboard charts
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for revenue trend analysis
 *         example: "2024-01-01"
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for revenue trend analysis
 *         example: "2024-12-31"
 *     responses:
 *       200:
 *         description: Revenue trend data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     period:
 *                       $ref: '#/components/schemas/DateRange'
 *                     byCategory:
 *                       type: array
 *                       description: Revenue breakdown by revenue category
 *                       items:
 *                         type: object
 *                         properties:
 *                           category:
 *                             type: string
 *                             enum: [market_taxes, tenement_rates, signboard_fees, livestock_fees, trade_permit, other_revenue]
 *                             example: "market_taxes"
 *                           invoiced:
 *                             type: number
 *                             description: Total amount invoiced for this category
 *                             example: 500000
 *                           collected:
 *                             type: number
 *                             description: Total amount collected for this category
 *                             example: 450000
 *                           invoiceCount:
 *                             type: integer
 *                             description: Number of invoices in this category
 *                             example: 25
 *                     dailyTrend:
 *                       type: array
 *                       description: Daily collection trend data
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                             description: Collection date
 *                           collected:
 *                             type: number
 *                             description: Amount collected on this date
 *                           transactions:
 *                             type: integer
 *                             description: Number of payment transactions
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.get('/revenue', ...guard, getRevenueTrend);

/**
 * @openapi
 * /chairman/wards:
 *   get:
 *     tags: [Chairman Dashboard]
 *     summary: Get ward performance comparison
 *     description: Comprehensive ward-level performance metrics including number of complaints, applications, businesses, and councillor information for each ward
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Ward performance data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   description: Array of wards with performance metrics
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                         example: "Ward A"
 *                       code:
 *                         type: string
 *                         example: "WD-001"
 *                       councillors:
 *                         type: array
 *                         description: Ward councillors assigned to this ward
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             firstName:
 *                               type: string
 *                             lastName:
 *                               type: string
 *                             isActive:
 *                               type: boolean
 *                       _count:
 *                         type: object
 *                         properties:
 *                           complaints:
 *                             type: integer
 *                             description: Total complaints in this ward
 *                           stateOfOriginApplications:
 *                             type: integer
 *                             description: Total applications in this ward
 *                           businesses:
 *                             type: integer
 *                             description: Registered businesses in this ward
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires chairman or super_admin role
 */
router.get('/wards', ...guard, getWardPerformance);

/**
 * @openapi
 * /chairman/applications:
 *   get:
 *     tags: [Chairman Dashboard]
 *     summary: Get application statistics
 *     description: Analysis of State of Origin certificate applications grouped by status and ward for monitoring processing efficiency
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Application statistics retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     byStatus:
 *                       type: object
 *                       description: Application count grouped by status
 *                       additionalProperties:
 *                         type: integer
 *                       example:
 *                         pending: 45
 *                         approved: 120
 *                         rejected: 8
 *                     byWard:
 *                       type: array
 *                       description: Applications breakdown by ward
 *                       items:
 *                         type: object
 *                         properties:
 *                           ward:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               code:
 *                                 type: string
 *                           count:
 *                             type: integer
 *                             description: Number of applications from this ward
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
router.get('/applications', ...guard, getApplicationStats);

/**
 * @openapi
 * /chairman/complaints:
 *   get:
 *     tags: [Chairman Dashboard]
 *     summary: Get complaint overview
 *     description: Comprehensive complaint analytics including status breakdown, resolution rates, and top wards with highest complaint volumes
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Complaint overview retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: Total number of complaints
 *                       example: 350
 *                     open:
 *                       type: integer
 *                       description: Number of open complaints requiring attention
 *                       example: 45
 *                     inProgress:
 *                       type: integer
 *                       description: Complaints currently being processed
 *                       example: 67
 *                     resolved:
 *                       type: integer
 *                       description: Resolved complaints
 *                       example: 238
 *                     breakdown:
 *                       type: object
 *                       description: Detailed breakdown by all statuses
 *                       additionalProperties:
 *                         type: integer
 *                       example:
 *                         open: 45
 *                         assigned: 23
 *                         in_progress: 67
 *                         resolved: 238
 *                         closed: 89
 *                     topWards:
 *                       type: array
 *                       description: Top 10 wards with highest complaint volumes
 *                       items:
 *                         type: object
 *                         properties:
 *                           ward:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                           count:
 *                             type: integer
 *                             description: Number of complaints from this ward
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Requires chairman or super_admin role
 */
router.get('/complaints', ...guard, getComplaintOverview);

export default router;