

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
// import { exportInvoices, exportReceipts, getReportsOverview } from './report.controller';
import { requireRole } from '../../middleware/authorize.middleware';
import { getReportsOverview } from './report.controller';

const router = Router();

requireRole("treasurer","super_admin","lga_admin")

// Exposed for general/public UI lookup elements
router.get('/overview',requireAuth,getReportsOverview);
// router.get('/export/invoices',requireAuth,exportInvoices);
// router.get('/export/receipts',requireAuth,exportReceipts);


export default router;