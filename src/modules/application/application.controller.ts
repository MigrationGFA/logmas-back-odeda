import { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import { sendSuccess, sendError } from "../../utils/response";
import * as ApplicationService from "./application.service";
import { createApplicationSchema } from "./application.validation";
import { prisma } from "../../utils/prisma";

export const createApplication = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let files = undefined as Express.Multer.File[] | undefined;
  try {
    const user = req.user!;

    // multer will populate files as req.files (array)
    files = (req as any).files as Express.Multer.File[] | undefined;

    // Build payload from multipart fields (form fields are strings). Parse formData if sent as JSON string.
    const raw = req.body || {};
    // Ignore any feeAmount supplied by frontend
    if ("feeAmount" in raw) delete raw.feeAmount;

    let parsedFormData: any = raw.formData ?? {};
    if (typeof parsedFormData === "string" && parsedFormData.length > 0) {
      try {
        parsedFormData = JSON.parse(parsedFormData);
      } catch (e) {
        // leave as string if not JSON
      }
    }

    const payload = {
      serviceId: raw.serviceId,
      applicantId: raw.applicantId,
      formData: parsedFormData,
    };

    // Validate common application fields
    const validation = createApplicationSchema.safeParse(payload);
    if (!validation.success) {
      // cleanup uploaded files if any
      if (files && files.length) {
        for (const f of files) {
          try {
            fs.unlinkSync(path.resolve(f.path));
          } catch (e) {
            /* ignore */
          }
        }
      }
      return sendError(
        res,
        "Data validation processing failed",
        "VALIDATION_ERROR",
        validation.error.format(),
        400,
      );
    }
    // Validate actor permissions and applicant resolution
    const actorRole = user.role;
    let applicantIdToUse: string | null = null;
    let createdById: string = user.id;

    if (actorRole === "citizen" || actorRole === "business_owner") {
      // citizens/business owners must be the applicant
      if (raw.applicantId && raw.applicantId !== user.id) {
        if (files && files.length) {
          for (const f of files) {
            try {
              fs.unlinkSync(path.resolve(f.path));
            } catch (e) {
              /* ignore */
            }
          }
        }
        return sendError(
          res,
          "You cannot submit an application on behalf of another applicant",
          "FORBIDDEN",
          null,
          403,
        );
      }
      applicantIdToUse = user.id;
      createdById = user.id;
    } else if (actorRole === "field_officer") {
      // Field officers may optionally provide applicantId; otherwise applicantId remains null
      if (raw.applicantId) {
        // validate user exists and is citizen or business_owner
        const target = await prisma.user.findUnique({
          where: { id: String(raw.applicantId) },
          select: { id: true, role: true },
        });
        if (!target) {
          if (files && files.length) {
            for (const f of files) {
              try {
                fs.unlinkSync(path.resolve(f.path));
              } catch (e) {
                /* ignore */
              }
            }
          }
          return sendError(
            res,
            "Supplied applicantId not found",
            "NOT_FOUND",
            null,
            404,
          );
        }
        if (!(target.role === "citizen" || target.role === "business_owner")) {
          if (files && files.length) {
            for (const f of files) {
              try {
                fs.unlinkSync(path.resolve(f.path));
              } catch (e) {
                /* ignore */
              }
            }
          }
          return sendError(
            res,
            "Field officers may only create applications for citizens or business owners",
            "VALIDATION_ERROR",
            null,
            400,
          );
        }
        applicantIdToUse = target.id;
      } else {
        applicantIdToUse = null;
      }
      createdById = user.id;
    } else {
      // other roles are not allowed to create applications
      if (files && files.length) {
        for (const f of files) {
          try {
            fs.unlinkSync(path.resolve(f.path));
          } catch (e) {
            /* ignore */
          }
        }
      }
      return sendError(
        res,
        "You are not allowed to create applications",
        "FORBIDDEN",
        null,
        403,
      );
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
            try {
              fs.unlinkSync(path.resolve(ff.path));
            } catch (e) {
              /* ignore */
            }
          }
          return sendError(
            res,
            `Duplicate document type uploaded: ${dt}`,
            "VALIDATION_ERROR",
            null,
            400,
          );
        }
        seen.add(dt);
      }

      // If service defines required document keys, validate fieldnames against that list
      const svc = await prisma.service.findUnique({
        where: { id: validation.data.serviceId },
        select: { id: true, isActive: true, requirements: true },
      });
      if (!svc) {
        for (const ff of files) {
          try {
            fs.unlinkSync(path.resolve(ff.path));
          } catch (e) {
            /* ignore */
          }
        }
        return sendError(res, "Service not found", "NOT_FOUND", null, 404);
      }
      if (!svc.isActive) {
        for (const ff of files) {
          try {
            fs.unlinkSync(path.resolve(ff.path));
          } catch (e) {
            /* ignore */
          }
        }
        return sendError(
          res,
          "Service is not active",
          "BAD_REQUEST",
          null,
          400,
        );
      }

      if (
        svc.requirements &&
        Array.isArray(svc.requirements) &&
        svc.requirements.length > 0
      ) {
        // Service.requirements represents REQUIRED document keys
        const missing = svc.requirements.filter(
          (reqKey: string) => !seen.has(reqKey),
        );
        if (missing.length > 0) {
          for (const ff of files) {
            try {
              fs.unlinkSync(path.resolve(ff.path));
            } catch (e) {
              /* ignore */
            }
          }
          return sendError(
            res,
            `Missing required documents: ${missing.join(", ")}`,
            "VALIDATION_ERROR",
            null,
            400,
          );
        }
        // Also check for any uploaded fields that are not allowed by requirements
        const invalid = Array.from(seen).filter(
          (dt) => !svc.requirements.includes(dt),
        );
        if (invalid.length > 0) {
          for (const ff of files) {
            try {
              fs.unlinkSync(path.resolve(ff.path));
            } catch (e) {
              /* ignore */
            }
          }
          return sendError(
            res,
            `Invalid document types for this service: ${invalid.join(", ")}`,
            "VALIDATION_ERROR",
            null,
            400,
          );
        }
      }
    }

    // Prepare file metadata for service
    const serverUrl = `${req.protocol}://${req.get("host")}`;
    const filesMeta = (files || []).map((f) => {
      const normalizedRelativePath = f.path.replace(/\\/g, "/");
      return {
        originalName: f.originalname,
        fileName: f.filename,
        relativePath: normalizedRelativePath,
        url: `${serverUrl}/${normalizedRelativePath}`,
        documentType: f.fieldname,
      } as any;
    });

    const result = await ApplicationService.createApplication({
      applicantId: applicantIdToUse ?? undefined,
      createdById: createdById,
      serviceId: validation.data.serviceId,
      formData: validation.data.formData,
      files: filesMeta,
    } as any);

    return sendSuccess(res, result, null, 201);
  } catch (err: any) {
    // Cleanup uploaded files on failure
    if (files && files.length) {
      for (const f of files) {
        try {
          fs.unlinkSync(path.resolve(f.path));
        } catch (e) {
          /* ignore */
        }
      }
    }
    // Known operational errors are forwarded to centralized error handler by throwing
    return next(err);
  }
};

export const getApplicationById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const app = await ApplicationService.getApplicationByIdOrNumber(String(id));
    if (!app)
      return sendError(res, "Application not found", "NOT_FOUND", null, 404);

    // Authorization: if requester is citizen/business_owner ensure they own it
    const user = req.user!;
    if (
      (user.role === "citizen" || user.role === "business_owner") &&
      app.applicantId !== user.id
    ) {
      return sendError(
        res,
        "You do not have permission to view this application",
        "FORBIDDEN",
        null,
        403,
      );
    }

    return sendSuccess(res, app);
  } catch (err) {
    next(err);
  }
};

export const listApplications = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user!;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 25;

    const result = await ApplicationService.listApplicationsForUser(
      user,
      page,
      limit,
    );

    return sendSuccess(res, result.items, result.meta);
  } catch (err) {
    next(err);
  }
};

// ── ADMIN (LGA) endpoints ──────────────────────────────────────────────────
export const adminListApplications = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 25;
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const serviceId =
      typeof req.query.serviceId === "string" ? req.query.serviceId : undefined;
    const search =
      typeof req.query.search === "string" ? req.query.search : undefined;

    const where: any = {};
    if (status) where.status = status;
    if (serviceId) where.serviceId = serviceId;
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { applicationNumber: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.application.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          service: true,
          invoice: true,
          applicationDocuments: true,
          applicant: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
        },
      }),
      prisma.application.count({ where }),
    ]);

    return sendSuccess(res, {
      data: items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

export const adminGetApplication = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];

    const app = await ApplicationService.getApplicationByIdOrNumber(String(id));
    if (!app)
      return sendError(res, "Application not found", "NOT_FOUND", null, 404);

    return sendSuccess(res, app);
  } catch (err) {
    next(err);
  }
};

export const adminSetUnderReview = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const adminId = req.user!.id;

    const app = await prisma.application.findUnique({
      where: { id: String(id) },
    });
    if (!app)
      return sendError(res, "Application not found", "NOT_FOUND", null, 404);
    if (app.status !== "submitted")
      return sendError(
        res,
        "Only submitted applications can be moved to under_review",
        "BAD_REQUEST",
        null,
        400,
      );

    const updated = await prisma.application.update({
      where: { id: String(id) },
      data: {
        status: "under_review",
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "approval_granted",
        entity: "Application",
        entityId: id,
        userId: adminId,
        details: { action: "under_review" },
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, updated, "Application moved to under_review");
  } catch (err) {
    next(err);
  }
};

export const adminApproveApplication = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const adminId = req.user!.id;

    const app = await prisma.application.findUnique({
      where: { id: String(id) },
    });
    if (!app)
      return sendError(res, "Application not found", "NOT_FOUND", null, 404);
    if (app.status !== "under_review")
      return sendError(
        res,
        "Only applications under review can be approved",
        "BAD_REQUEST",
        null,
        400,
      );

    const updated = await prisma.application.update({
      where: { id: String(id) },
      data: {
        status: "approved",
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "approval_granted",
        entity: "Application",
        entityId: id,
        userId: adminId,
        details: { action: "approved" },
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, updated, "Application approved");
  } catch (err) {
    next(err);
  }
};

export const adminDeclineApplication = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const adminId = req.user!.id;
    const { declineReason } = req.body;

    if (
      !declineReason ||
      (typeof declineReason === "string" && declineReason.trim().length === 0)
    ) {
      return sendError(
        res,
        "declineReason is required when declining an application",
        "VALIDATION_ERROR",
        null,
        400,
      );
    }

    const app = await prisma.application.findUnique({
      where: { id: String(id) },
    });
    if (!app)
      return sendError(res, "Application not found", "NOT_FOUND", null, 404);
    if (app.status !== "under_review")
      return sendError(
        res,
        "Only applications under review can be declined",
        "BAD_REQUEST",
        null,
        400,
      );

    const updated = await prisma.application.update({
      where: { id: String(id) },
      data: {
        status: "declined",
        reviewedById: adminId,
        reviewedAt: new Date(),
        declineReason,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "application_rejected",
        entity: "Application",
        entityId: id,
        userId: adminId,
        details: { declineReason },
        ipAddress: req.ip,
      },
    });

    return sendSuccess(res, updated, "Application declined");
  } catch (err) {
    next(err);
  }
};
