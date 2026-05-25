import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/users.routes';
import wardRoutes from './modules/wards/ward.routes';
import complaintRoutes from './modules/complaints/complaints.routes';
import permitRoutes from './modules/permits/permits.routes';

import { errorHandler } from './middleware/error.middleware';
const swaggerDocument = require('./config/swagger');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// API Engine Base Routing Architecture
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/wards', wardRoutes);
app.use('/api/v1/complaints', complaintRoutes);
app.use('/api/v1/permits', permitRoutes);

// Shared Interactive Engine Schema Verification Explorer Links UI Routes
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Catch-All Global Pipeline Middleware Interceptors Engine Layer Handler
app.use(errorHandler);

export default app;