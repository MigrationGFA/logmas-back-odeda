

import { Router } from 'express';
import {  getWardsList } from './general.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

// Exposed for general/public UI lookup elements
router.get('/wards',requireAuth, getWardsList);


export default router;