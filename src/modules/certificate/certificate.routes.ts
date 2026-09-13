import { Router } from 'express';
import { getCertificates, getCertificateById } from './certificate.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

/**
 * @openapi
 * /api/v1/certificates:
 *  get:
 *   summary: Retrieve a list of issued certificates/licences
 *   description: Fetches certificates together with their originating application and service details. Output is scoped by role and team isolation matrices.
 *   tags: [Certificates]
 *   security:
 *    - bearerAuth: []
 *   responses:
 *    200:
 *     description: Array of available certificates returned successfully inside the global envelope.
 *     content:
 *      application/json:
 *       schema:
 *        type: object
 *        properties:
 *         status:
 *          type: string
 *          example: success
 *         data:
 *          type: array
 *          items:
 *           type: object
 *           properties:
 *            id:
 *             type: string
 *             example: "cert-83921-uuid"
 *            certificateNumber:
 *             type: string
 *             example: "ODE/CERT/2026/00101"
 *            verificationCode:
 *             type: string
 *             example: "V-CODE-83910"
 *            issuedAt:
 *             type: string
 *             format: date-time
 *            expiresAt:
 *             type: string
 *             format: date-time
 *             nullable: true
 *            pdfUrl:
 *             type: string
 *             nullable: true
 *            application:
 *             type: object
 *             properties:
 *              applicationNumber:
 *               type: string
 *               example: "ODE-APP-2026-000101"
 *              status:
 *               type: string
 *               example: "approved"
 *            service:
 *             type: object
 *             properties:
 *              name:
 *               type: string
 *               example: "Certificate of Origin"
 *              certificateType:
 *               type: string
 *               example: "CERTIFICATE_OF_ORIGIN"
 *         error:
 *          type: string
 *          nullable: true
 *          example: null
 */
router.get('/', getCertificates);

/**
 * @openapi
 * /api/v1/certificates/{id}:
 *  get:
 *   summary: Fetch a single issued certificate/licence with full details
 *   description: Queries by matching the unique row ID, certificate number, or verification code, returning the application, service and certificate information together.
 *   tags: [Certificates]
 *   security:
 *    - bearerAuth: []
 *   parameters:
 *    - in: path
 *      name: id
 *      required: true
 *      schema:
 *       type: string
 *      description: Database primary key UUID string, sequential Certificate Number, or Verification Code.
 *   responses:
 *    200:
 *     description: Complete validated certificate snapshot returned, including application and service information.
 *     content:
 *      application/json:
 *       schema:
 *        type: object
 *        properties:
 *         status:
 *          type: string
 *          example: success
 *         data:
 *          type: object
 *          properties:
 *           id:
 *            type: string
 *           certificateNumber:
 *            type: string
 *            example: "ODE/CERT/2026/00101"
 *           verificationCode:
 *            type: string
 *           qrToken:
 *            type: string
 *           issuedAt:
 *            type: string
 *            format: date-time
 *           expiresAt:
 *            type: string
 *            format: date-time
 *            nullable: true
 *           pdfUrl:
 *            type: string
 *            nullable: true
 *           issuedBy:
 *            type: object
 *            nullable: true
 *            properties:
 *             id:
 *              type: string
 *             name:
 *              type: string
 *             role:
 *              type: string
 *           application:
 *            type: object
 *            properties:
 *             id:
 *              type: string
 *             applicationNumber:
 *              type: string
 *             status:
 *              type: string
 *             feeAmount:
 *              type: number
 *             formData:
 *              type: object
 *             applicant:
 *              type: object
 *              nullable: true
 *           service:
 *            type: object
 *            properties:
 *             id:
 *              type: string
 *             code:
 *              type: string
 *             name:
 *              type: string
 *             category:
 *              type: string
 *             certificateType:
 *              type: string
 *           invoice:
 *            type: object
 *            nullable: true
 *            properties:
 *             id:
 *              type: string
 *             invoiceNumber:
 *              type: string
 *             amount:
 *              type: number
 *             paymentStatus:
 *              type: string
 *    404:
 *     description: Target certificate was missing or access validation rejected.
 */
router.get('/:id', getCertificateById);

export default router;
