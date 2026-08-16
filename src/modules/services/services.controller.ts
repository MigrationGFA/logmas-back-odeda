import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../utils/prisma';
import { sendSuccess, sendError } from '../../utils/response';
import { queryString } from '../../utils/request';

// GET /api/v1/services — public list of all active services
export const listServices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Resolve role from the authenticated user when possible and fallback to a
    // query-string role for frontend-driven usage in several screens.
    const role = (req as any).user?.role ?? (req.query.role as string) ?? 'public';
    const normalizedRole = String(role).toLowerCase();

    const category = queryString(req.query.category);

    const services = await prisma.service.findMany({
      where: {
        isActive: true,
        ...(category && { category: category as any }),
      },
      include: {
        feeSchedules: {
          where: { isActive: true },
          select: { id: true, name: true, baseFee: true, feeType: true, billingCycle: true },
        },
        _count: { select: { applications: true } },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // Expose a stable role-aware payload so the same endpoint can be consumed by
    // multiple frontend pages without forcing each UI to re-shape the response.
    return sendSuccess(res, {
      role: normalizedRole,
      services,
    });
  } catch (err) { next(err); }
};

// GET /api/v1/services/:slug — single service detail
export const getServiceBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;

    const service = await prisma.service.findUnique({
      where: { slug },
      include: {
        feeSchedules: { where: { isActive: true } },
      },
    });

    if (!service) return sendError(res, 'Service not found', 'NOT_FOUND', null, 404);

    return sendSuccess(res, service);
  } catch (err) { next(err); }
};