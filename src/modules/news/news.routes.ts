// src/modules/news/news.routes.ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/authorize.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { createNewsSchema, updateNewsSchema } from './news.validation';
import {
  listPublicNews,
  getPublicArticle,
  listAdminNews,
  createNews,
  updateNews,
  deleteNews,
} from './news.controller';

const router = Router();

const guard = [requireAuth, requireRole('chairman', 'lga_admin')];

// ── Public (no auth) ──
router.get('/news', listPublicNews);
router.get('/news/:slug', getPublicArticle);

// ── Dashboard (chairman + lga_admin) ──
router.get('/lga/news', ...guard, listAdminNews);
router.post('/lga/news', ...guard, validateBody(createNewsSchema), createNews);
router.patch('/lga/news/:id', ...guard, validateBody(updateNewsSchema), updateNews);
router.delete('/lga/news/:id', ...guard, deleteNews);

export default router;
