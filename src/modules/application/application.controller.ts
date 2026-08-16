import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { sendSuccess, sendError } from '../../utils/response';
import * as ApplicationService from './application.service';
import { createApplicationSchema } from './application.validation';
import { prisma } from '../../utils/prisma';

export const createApplication = async (req: Request, res: Response, next: NextFunction) => {
  let files = undefined as Express.Multer.File[] | undefined;
  try {
    const user = req.user!;

    // multer will populate files as req.files (array)
    files = (req as any).files as Express.Multer.File[] | undefined;

    // Build payload from multipart fields (form fields are strings). Parse formData if sent as JSON string.
    const raw = req.body || {};
    // Ignore any feeAmount supplied by frontend
    if ('feeAmount' in raw) delete raw.feeAmount;

    let parsedFormData: any = raw.formData ?? {};
    if (typeof parsedFormData === 'string' && parsedFormData.length > 0) {
      try {
        parsedFormData = JSON.parse(parsedFormData);
      } catch (e) {
        // leave as string if not JSON
      }
    }

    const payload = {
      serviceId: raw.serviceId,
      fullName: raw.fullName,
      phone: raw.phone,
      email: raw.email,
      address: raw.address,
      ward: raw.ward,
      nin: raw.nin,
      cacNumber: raw.cacNumber,
      formData: parsedFormData,
    };

    // Validate common application fields
    const validation = createApplicationSchema.safeParse(payload);
    if (!validation.success) {
      // cleanup uploaded files if any
      if (files && files.length) {
        for (const f of files) {
          try { fs.unlinkSync(path.resolve(f.path)); } catch (e) { /* ignore */ }
        }
      }
      return sendError(res, 'Data validation processing failed', 'VALIDATION_ERROR', validation.error.format(), 400);
    }
    // Validate uploaded files: document type is taken from each file's fieldname
    if (files && files.length > 0) {
      // Prevent duplicate document types in submission
      const seen = new Set<string>();
      for (const f of files) {
        const dt = f.fieldname;
        if (seen.has(dt)) {
          // cleanup
          for (const ff of files) {
            try { fs.unlinkSync(path.resolve(ff.path)); } catch (e) { /* ignore */ }
          }
          return sendError(res, `Duplicate document type uploaded: ${dt}`, 'VALIDATION_ERROR', null, 400);
        }
        seen.add(dt);
      }

      // If service defines required document keys, validate fieldnames against that list
      const svc = await prisma.service.findUnique({ where: { id: validation.data.serviceId }, select: { id: true, isActive: true, requirements: true } });
      if (!svc) {
        for (const ff of files) {
          try { fs.unlinkSync(path.resolve(ff.path)); } catch (e) { /* ignore */ }
        }
        return sendError(res, 'Service not found', 'NOT_FOUND', null, 404);
      }
      if (!svc.isActive) {
        for (const ff of files) {
          try { fs.unlinkSync(path.resolve(ff.path)); } catch (e) { /* ignore */ }
        }
        return sendError(res, 'Service is not active', 'BAD_REQUEST', null, 400);
      }

      if (svc.requirements && Array.isArray(svc.requirements) && svc.requirements.length > 0) {
        const invalid = Array.from(seen).filter((dt) => !svc.requirements.includes(dt));
        if (invalid.length > 0) {
          for (const ff of files) {
            try { fs.unlinkSync(path.resolve(ff.path)); } catch (e) { /* ignore */ }
          }
          return sendError(res, `Invalid document types for this service: ${invalid.join(', ')}`, 'VALIDATION_ERROR', null, 400);
        }
      }
    }

    // Prepare file metadata for service
    const serverUrl = `${req.protocol}://${req.get('host')}`;
    const filesMeta = (files || []).map((f) => {
      const normalizedRelativePath = f.path.replace(/\\/g, '/');
      return {
        originalName: f.originalname,
        fileName: f.filename,
        relativePath: normalizedRelativePath,
        url: `${serverUrl}/${normalizedRelativePath}`,
        documentType: f.fieldname,
      } as any;
    });

    const result = await ApplicationService.createApplication({
      applicantId: user.id,
      serviceId: validation.data.serviceId,
      fullName: validation.data.fullName,
      phone: validation.data.phone,
      email: validation.data.email,
      address: validation.data.address,
      ward: validation.data.ward,
      nin: validation.data.nin,
      cacNumber: validation.data.cacNumber,
      formData: validation.data.formData,
      files: filesMeta,
    });

    return sendSuccess(res, result, null, 201);
  } catch (err: any) {
    // Cleanup uploaded files on failure
    if (files && files.length) {
      for (const f of files) {
        try { fs.unlinkSync(path.resolve(f.path)); } catch (e) { /* ignore */ }
      }
    }
    // Known operational errors are forwarded to centralized error handler by throwing
    return next(err);
  }
};

export const getApplicationById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const app = await ApplicationService.getApplicationByIdOrNumber(String(id));
    if (!app) return sendError(res, 'Application not found', 'NOT_FOUND', null, 404);

    // Authorization: if requester is citizen/business_owner ensure they own it
    const user = req.user!;
    if ((user.role === 'citizen' || user.role === 'business_owner') && app.applicantId !== user.id) {
      return sendError(res, 'You do not have permission to view this application', 'FORBIDDEN', null, 403);
    }

    return sendSuccess(res, app);
  } catch (err) {
    next(err);
  }
};

export const listApplications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 25;

    const result = await ApplicationService.listApplicationsForUser(user, page, limit);

    return sendSuccess(res, result.items, result.meta);
  } catch (err) {
    next(err);
  }
};
