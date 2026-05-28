"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// complaints.routes.ts
const express_1 = require("express");
const complaints_controller_1 = require("./complaints.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const role_middleware_1 = require("../../middleware/role.middleware");
const complaints_validation_1 = require("./complaints.validation");
const validate_middleware_1 = require("../../middleware/validate.middleware");
const router = (0, express_1.Router)();
/**
 * @openapi
 * tags:
 *   - name: Complaints
 *     description: Complaint management endpoints
 */
// ============================================================
// PUBLIC & CITIZEN ENDPOINTS
// ============================================================
/**
 * @openapi
 * /complaints:
 *   post:
 *     tags: [Complaints]
 *     summary: Raise a new complaint
 *     description: Citizens can submit a complaint about public services or issues in their ward
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description, wardId]
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 200
 *                 example: "Broken Street Light"
 *               description:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 5000
 *                 example: "The street light at junction has been broken for 2 weeks"
 *               wardId:
 *                 type: string
 *                 format: uuid
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       201:
 *         description: Complaint raised successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     ticketNumber:
 *                       type: string
 *                     title:
 *                       type: string
 *                     status:
 *                       type: string
 *       400:
 *         description: Validation error or ward not found
 *       401:
 *         description: Unauthorized
 */
router.post('/', auth_middleware_1.requireAuth, (0, role_middleware_1.requireRole)('citizen', 'business_owner'), (0, validate_middleware_1.validateBody)(complaints_validation_1.raiseComplaintSchema), complaints_controller_1.raiseComplaint);
/**
 * @openapi
 * /complaints/my:
 *   get:
 *     tags: [Complaints]
 *     summary: Get my complaints
 *     description: Citizens can view all complaints they have submitted
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, assigned, in_progress, resolved, closed]
 *         description: Filter by status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of complaints retrieved
 *       401:
 *         description: Unauthorized
 */
router.get('/my', auth_middleware_1.requireAuth, (0, role_middleware_1.requireRole)('citizen', 'business_owner'), complaints_controller_1.getMyComplaints);
/**
 * @openapi
 * /complaints/my/{id}:
 *   get:
 *     tags: [Complaints]
 *     summary: Get specific complaint by ID
 *     description: Citizens can view details of a specific complaint they submitted
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Complaint details retrieved
 *       404:
 *         description: Complaint not found
 *       401:
 *         description: Unauthorized
 */
router.get('/my/:id', auth_middleware_1.requireAuth, (0, role_middleware_1.requireRole)('citizen', 'business_owner'), complaints_controller_1.getMyComplaintById);
// ============================================================
// WARD COUNCILLOR ENDPOINTS
// ============================================================
/**
 * @openapi
 * /complaints/ward:
 *   get:
 *     tags: [Complaints]
 *     summary: Get ward complaints (Councillor)
 *     description: Ward councillors can view complaints from their assigned ward only
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, assigned, in_progress, resolved, closed]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Ward complaints retrieved
 *       400:
 *         description: No ward assigned to councillor
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires ward_councillor role
 */
router.get('/ward', auth_middleware_1.requireAuth, (0, role_middleware_1.requireRole)('ward_councillor'), complaints_controller_1.getWardComplaints);
/**
 * @openapi
 * /complaints/ward/{id}/respond:
 *   post:
 *     tags: [Complaints]
 *     summary: Respond to ward complaint (Councillor)
 *     description: Ward councillors can respond to complaints in their ward
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *     responses:
 *       200:
 *         description: Response submitted
 *       403:
 *         description: Complaint not in councillor's ward
 *       404:
 *         description: Complaint not found
 */
router.post('/ward/:id/respond', auth_middleware_1.requireAuth, (0, role_middleware_1.requireRole)('ward_councillor'), (0, validate_middleware_1.validateBody)(complaints_validation_1.respondToComplaintSchema), complaints_controller_1.wardCouncillorRespond);
// ============================================================
// LGA ADMIN ENDPOINTS
// ============================================================
/**
 * @openapi
 * /complaints/admin:
 *   get:
 *     tags: [Complaints]
 *     summary: Get all complaints (Admin)
 *     description: LGA Admin can view all complaints across all wards with filters
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, assigned, in_progress, resolved, closed]
 *       - in: query
 *         name: wardId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: All complaints retrieved
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires lga_admin role
 */
router.get('/admin', auth_middleware_1.requireAuth, (0, role_middleware_1.requireRole)('super_admin', 'lga_admin'), complaints_controller_1.getAllComplaints);
/**
 * @openapi
 * /complaints/admin/{id}:
 *   get:
 *     tags: [Complaints]
 *     summary: Get complaint by ID (Admin)
 *     description: LGA Admin can view full details of any complaint
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Complaint details retrieved
 *       404:
 *         description: Complaint not found
 */
router.get('/admin/:id', auth_middleware_1.requireAuth, (0, role_middleware_1.requireRole)('super_admin', 'lga_admin'), complaints_controller_1.getComplaintById);
/**
 * @openapi
 * /complaints/admin/{id}/assign:
 *   patch:
 *     tags: [Complaints]
 *     summary: Assign complaint to officer/councillor
 *     description: LGA Admin can assign complaints to ward councillors or field officers
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [assignedToId]
 *             properties:
 *               assignedToId:
 *                 type: string
 *                 format: uuid
 *                 description: User ID of assignee (must be ward_councillor, field_officer, or lga_admin)
 *     responses:
 *       200:
 *         description: Complaint assigned successfully
 *       400:
 *         description: Cannot assign resolved/closed complaint or invalid assignee role
 *       404:
 *         description: Complaint or assignee not found
 *       403:
 *         description: Forbidden
 */
router.patch('/admin/:id/assign', auth_middleware_1.requireAuth, (0, role_middleware_1.requireRole)('super_admin', 'lga_admin'), (0, validate_middleware_1.validateBody)(complaints_validation_1.assignComplaintSchema), complaints_controller_1.assignComplaint);
/**
 * @openapi
 * /complaints/admin/{id}/status:
 *   patch:
 *     tags: [Complaints]
 *     summary: Update complaint status (Admin)
 *     description: LGA Admin can update the status of any complaint
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [open, assigned, in_progress, resolved, closed]
 *               resolutionNote:
 *                 type: string
 *                 description: Required when status is 'resolved' or 'closed'
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: Cannot update closed complaint
 *       404:
 *         description: Complaint not found
 */
router.patch('/admin/:id/status', auth_middleware_1.requireAuth, (0, role_middleware_1.requireRole)('super_admin', 'lga_admin'), (0, validate_middleware_1.validateBody)(complaints_validation_1.updateComplaintStatusSchema), complaints_controller_1.updateComplaintStatus);
/**
 * @openapi
 * /complaints/admin/{id}/respond:
 *   post:
 *     tags: [Complaints]
 *     summary: Admin responds to complaint
 *     description: LGA Admin can add responses to any complaint
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *     responses:
 *       200:
 *         description: Response added
 *       400:
 *         description: Cannot respond to closed complaint
 *       404:
 *         description: Complaint not found
 */
router.post('/admin/:id/respond', auth_middleware_1.requireAuth, (0, role_middleware_1.requireRole)('super_admin', 'lga_admin'), (0, validate_middleware_1.validateBody)(complaints_validation_1.respondToComplaintSchema), complaints_controller_1.adminRespond);
// ============================================================
// STATISTICS ENDPOINTS
// ============================================================
/**
 * @openapi
 * /complaints/stats:
 *   get:
 *     tags: [Complaints]
 *     summary: Get complaint statistics
 *     description: Returns complaint counts grouped by status for dashboard widgets
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     breakdown:
 *                       type: object
 *                       properties:
 *                         open:
 *                           type: integer
 *                         assigned:
 *                           type: integer
 *                         in_progress:
 *                           type: integer
 *                         resolved:
 *                           type: integer
 *                         closed:
 *                           type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/stats', auth_middleware_1.requireAuth, (0, role_middleware_1.requireRole)('super_admin', 'lga_admin'), complaints_controller_1.getComplaintStats);
exports.default = router;
