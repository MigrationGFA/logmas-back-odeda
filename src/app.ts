import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/users.routes';
import wardRoutes from './modules/ward/wards.routes';
import complaintRoutes from './modules/complaints/complaints.routes';
import fieldOperationsRoutes from './modules/operations/field.routes';
import stateOfOriginRoutes from './modules/stateOfOrigin/stateOfOrigin.routes';
import businessRoutes from './modules/business/business.routes';
import uploadRoutes from './modules/uploads/upload.routes';
import lgaRoutes from './modules/lgaAdmin/lgaAdmin.routes';
import revCat from './modules/revenueCategory/revenueCategory.routes';
import reportRoutes from './modules/report/report.routes';
import contractorRoutes from './modules/contractor/contractor.routes';
import auditorRoutes   from './modules/auditor/auditor.routes';
import chairmanRoutes   from './modules/chairman/chairman.routes';
import superAdminRoutes from './modules/superAdmin/superAdmin.routes';
import treasurerRoutes from './modules/treasurer/treasurer.routes';
import permitRoutes from './modules/permits/permits.routes';
import gernralRoutes from './modules/general/general.routes';
import invoiceRoutes from './modules/invoice/invoice.routes';
import receiptRoutes from './modules/receipts/receipt.routes';
import dashboardRoutes from './modules/dashboard/dashboard.controller';

import { errorHandler } from './middleware/error.middleware';
import { swaggerDocument } from './config/swagger';


const app = express();

app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Base Health-Check Endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: "healthy",
    system: "LOGMAS API Engine",
    version: "1.0.0-phase1",
    timestamp: new Date().toISOString()
  });
});

app.use('/public', express.static('public'));

// API Engine Base Routing Architecture
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/wards', wardRoutes);
app.use('/api/v1/lga', lgaRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/categories', revCat);
app.use('/api/v1/contractor', contractorRoutes);
app.use('/api/v1/treasurer', treasurerRoutes);
app.use('/api/v1/auditor',   auditorRoutes);
app.use('/api/v1/complaints', complaintRoutes);
app.use('/api/v1/permits', permitRoutes);
app.use('/api/v1/general', gernralRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/state-of-origin', stateOfOriginRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/business', businessRoutes);
app.use('/api/v1/field-officer', fieldOperationsRoutes);
app.use('/api/v1/uploads', uploadRoutes);
app.use('/api/v1/receipts', receiptRoutes);
app.use('/api/v1/chairman',    chairmanRoutes);
app.use('/api/v1/super-admin', superAdminRoutes);


// Shared Interactive Engine Schema Verification Explorer Links UI Routes
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Catch-All Global Pipeline Middleware Interceptors Engine Layer Handler
app.use(errorHandler);

export default app;