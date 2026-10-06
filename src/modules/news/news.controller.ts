// src/modules/news/news.controller.ts
import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../../utils/response';
import * as NewsService from './news.service';

const queryString = (val: unknown): string | undefined => {
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val[0] as string;
  return undefined;
};

const parsePageLimit = (req: Request) => {
  const rawPage = parseInt(queryString(req.query.page) ?? '1', 10);
  const rawLimit = parseInt(queryString(req.query.limit) ?? '10', 10);
  return {
    page: Number.isFinite(rawPage) ? rawPage : 1,
    limit: Number.isFinite(rawLimit) ? rawLimit : 10,
  };
};

/**
 * GET /api/v1/news — PUBLIC. Only published, non-deleted.
 */
export const listPublicNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = parsePageLimit(req);
    const result = await NewsService.listPublicNews({
      tag: queryString(req.query.tag),
      search: queryString(req.query.search),
      page,
      limit,
    });
    return sendSuccess(res, { data: result.data, meta: result.meta });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/news/:slug — PUBLIC. One published article.
 */
export const getPublicArticle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const article = await NewsService.getPublicBySlug(String(req.params.slug));
    if (!article) return sendError(res, 'News article not found', 'NOT_FOUND', null, 404);
    return sendSuccess(res, article);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/lga/news — chairman + lga_admin. All statuses except soft-deleted.
 */
export const listAdminNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = parsePageLimit(req);
    const result = await NewsService.listAdminNews({
      status: queryString(req.query.status),
      tag: queryString(req.query.tag),
      search: queryString(req.query.search),
      page,
      limit,
    });
    return sendSuccess(res, { data: result.data, meta: result.meta });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/lga/news — chairman + lga_admin.
 * authorId/authorName/slug always come from the server, never the body.
 */
export const createNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const article = await NewsService.createNews(req.body, { id: req.user!.id });
    return sendSuccess(res, article, 'News article created successfully', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/lga/news/:id — chairman + lga_admin.
 */
export const updateNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await NewsService.getById(String(req.params.id));
    if (!existing) return sendError(res, 'News article not found', 'NOT_FOUND', null, 404);
    const updated = await NewsService.updateNews(String(req.params.id), req.body);
    return sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/lga/news/:id — chairman + lga_admin. Soft-delete.
 */
export const deleteNews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ok = await NewsService.softDeleteNews(String(req.params.id));
    if (!ok) return sendError(res, 'News article not found', 'NOT_FOUND', null, 404);
    return sendSuccess(res, null, 'News article deleted successfully');
  } catch (err) {
    next(err);
  }
};
