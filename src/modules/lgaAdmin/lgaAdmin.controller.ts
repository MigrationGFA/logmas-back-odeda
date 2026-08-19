// src/modules/lgaAdmin/lgaAdmin.controller.ts
import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../../utils/prisma";
import { sendSuccess, sendError } from "../../utils/response";
import { PermitStatus, Role } from "@prisma/client";
import { getIp, queryString } from "../complaints/complaints.controller";
import { notify } from "../notification/notification.service";

// ─────────────────────────────────────────────────────────────
// WARD MANAGEMENT
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/lga-admin/wards
 * Create a new ward.
 */
export const createWard = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user!.id;
    const { name, code, description } = req.body;

    const existing = await prisma.ward.findFirst({
      where: { OR: [{ name }, { code }] },
    });
    if (existing) {
      return sendError(
        res,
        "A ward with this name or code already exists",
        "CONFLICT",
        null,
        409,
      );
    }

    const ward = await prisma.ward.create({
      data: { name, code, description },
    });

    return sendSuccess(res, { data: ward });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/lga-admin/wards
 * List all wards with councillor info and stats.
 */
export const listWards = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = parseInt(queryString(req.query.page) ?? "1");
    const limit = parseInt(queryString(req.query.limit) ?? "20");
    const skip = (page - 1) * limit;

    const [wards, total] = await Promise.all([
      prisma.ward.findMany({
        skip,
        take: limit,
        // where: { deletedAt: null },
        include: {
     
          _count: {
            select: {
              complaints: true,
              // businesses: true,
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.ward.count({ where: { } }),
    ]);

    // Format output payload array to match what your UI layout table expects
    const formattedWards = wards.map((w) => ({
      ...w,
    }));

    return sendSuccess(res, {
      data: formattedWards,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/lga-admin/wards/:id
 * Get single ward with full detail.
 */
export const getWardById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];

    const ward = await prisma.ward.findUnique({
      where: { id },
      include: {
        councillor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            complaints: true,
            stateOfOriginApplications: true,
            businesses: true,
          },
        },
      },
    });

    if (!ward) return sendError(res, "Ward not found", "NOT_FOUND", null, 404);

    return sendSuccess(res, ward);
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/lga-admin/wards/:id
 * Update ward details.
 */
export const updateWard = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const adminId = req.user!.id;

    const ward = await prisma.ward.findUnique({ where: { id } });
    if (!ward) return sendError(res, "Ward not found", "NOT_FOUND", null, 404);

    const updated = await prisma.ward.update({
      where: { id },
      data: req.body,
    });

    await prisma.auditLog.create({
      data: {
        action: "user_updated",
        entity: "Ward",
        entityId: id,
        userId: adminId,
        details: req.body,
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(res, updated, "Ward updated");
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/lga-admin/wards/:id/assign-councillor
 * Assign a ward councillor to a ward.
 * Councillor must already exist as a user with role = ward_councillor.
 */
export const assignCouncillor = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const adminId = req.user!.id;
    const { councillorId } = req.body;

    const [ward, councillor] = await Promise.all([
      prisma.ward.findUnique({ where: { id } }),
      prisma.user.findUnique({ where: { id: councillorId } }),
    ]);

    if (!ward) return sendError(res, "Ward not found", "NOT_FOUND", null, 404);
    if (!councillor)
      return sendError(
        res,
        "Councillor user not found",
        "NOT_FOUND",
        null,
        404,
      );

    if (councillor.role !== "ward_councillor") {
      return sendError(
        res,
        "User must have the ward_councillor role to be assigned to a ward",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    // Unassign councillor from any previous ward then assign to new one
    await prisma.user.update({
      where: { id: councillorId },
      data: { assignedWardId: id },
    });

    await prisma.auditLog.create({
      data: {
        action: "user_updated",
        entity: "Ward",
        entityId: id,
        userId: adminId,
        details: { councillorId, action: "assigned_councillor" },
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(
      res,
      { wardId: id, councillorId },
      "Councillor assigned to ward",
    );
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/lga-admin/wards/:id
 * Soft delete a ward.
 */
export const deleteWard = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const adminId = req.user!.id;

    const ward = await prisma.ward.findUnique({ where: { id } });
    if (!ward) return sendError(res, "Ward not found", "NOT_FOUND", null, 404);

    await prisma.ward.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        action: "user_suspended",
        entity: "Ward",
        entityId: id,
        userId: adminId,
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(res, null, "Ward deactivated");
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// STAFF MANAGEMENT
// ────────────────────────────────────────────────────/ Adjust to your actual notify utility import path

// Your secure password randomizer function
export function generateTempPassword(length = 12): string {
  const charset = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  const bytes = crypto.randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset[bytes[i] % charset.length];
  }
  return password;
}

/**
 * POST /api/v1/lga-admin/staff
 * LGA Admin creates a new staff account and notifies them with credentials.
 */
export const createStaff = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const adminId = req.user!.id;
    const { email, firstName, lastName, phone, role, wardId, contractorId } =
      req.body;

    const allowedRoles: Role[] = [
      "ward_councillor",
      "contractor",
      "field_officer",
      "agent",
      "citizen",
      "business_owner",
      "auditor",
      "treasurer",
      "chairman",
    ];
    if (!allowedRoles.includes(role as Role)) {
      return sendError(
        res,
        "LGA Admin can only create allowed platform staff accounts",
        "FORBIDDEN",
        null,
        403,
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      return sendError(res, "Email already registered", "CONFLICT", null, 409);

    // Validate ward exists if provided
    if (wardId) {
      const ward = await prisma.ward.findUnique({ where: { id: wardId } });
      if (!ward)
        return sendError(res, "Ward not found", "NOT_FOUND", null, 404);
    }

    // 1. Generate the unique random temporary password per execution call
    const uniqueTempPassword = generateTempPassword(12);

    // 2. Hash the dynamically generated password securely
    const hashedPassword = await bcrypt.hash(uniqueTempPassword, 12);

    // 3. Determine ward mapping based on the role
    const isWardCouncillor = role === "ward_councillor";
    const isFieldOfficer = role === "field_officer";

    const staff = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        ...(phone && { phone }),
        password: hashedPassword,
        createdById: adminId,
        role: role as Role,
        // Match the specific schema properties for WC vs FO
        ...(wardId && isWardCouncillor && { assignedWardId: wardId }),
        ...(wardId &&
          (isFieldOfficer || isWardCouncillor) && { wardId: wardId }),
        // ...(contractorId && { contractorId }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        wardId: true,
        assignedWardId: true,
        // contractorId: true,
        isActive: true,
        createdAt: true,
      },
    });

    // 4. Create Audit Log
    await prisma.auditLog.create({
      data: {
        action: "user_created",
        entity: "User",
        entityId: staff.id,
        userId: adminId,
        details: { role, email, wardId, contractorId },
        ipAddress: getIp(req),
      },
    });

    // 5. Send Notification containing credentials to the newly created staff member
    try {
      await notify({
        userId: staff.id,
        to: { phone: staff.phone || "", email: staff.email },
        templateKey: "account.welcomeStaff", // Points to your newly added layout block
        vars: {
          applicant_name: `${staff.firstName} ${staff.lastName}`,
          temp_password: uniqueTempPassword,
        },
        channels: ["sms", "email"],
      });
    } catch (notifyErr) {
      console.error(
        "[createStaff] notify() failed, continuing anyway:",
        notifyErr,
      );
    }

    // 6. Return response to the Admin dashboard creator
    return sendSuccess(
      res,
      {
        staff,
        // temporaryPassword: uniqueTempPassword, // Safe single administrative review return
        notice:
          "Staff account created successfully. They have been sent their login credentials via email and SMS.",
      },
      "Staff account created successfully",
      201,
    );
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/lga-admin/staff
 * List all staff with role and ward filters.
 */
export const listStaff = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const role = queryString(req.query.role) as Role | undefined;
    const wardId = queryString(req.query.wardId);
    const isActive =
      req.query.isActive !== undefined
        ? req.query.isActive === "true"
        : undefined;
    const page = parseInt(queryString(req.query.page) ?? "1");
    const limit = parseInt(queryString(req.query.limit) ?? "10");
    const skip = (page - 1) * limit;

    // Exclude super_admin, lga_admin, citizen, business_owner from staff list
    const staffRoles: Role[] = [
      "ward_councillor",
      "contractor",
      "field_officer",
      "agent",
      "chairman",
      "treasurer",
      "auditor",
    ];

    const where: any = {
      role: { in: role ? [role] : staffRoles },
      // deletedAt: null,
      ...(wardId !== undefined && { wardId }),
      ...(isActive !== undefined && { isActive }),
    };

    const [staff, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          phone: true,
          isActive: true,
          wardId: true,
          ward: { select: { id: true, name: true } },
          createdAt: true,
          lastLoginAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    return sendSuccess(res, {
      data: staff,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/lga-admin/staff/:id
 * Get a single staff member with full profile.
 */
export const getStaffById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];

    const staff = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        isActive: true,
        address: true,
        wardId: true,
        ward: { select: { id: true, name: true, code: true } },
        contractorId: true,
        contractor: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        // fieldOfficers: {
        //   select: {
        //     id: true,
        //     firstName: true,
        //     lastName: true,
        //     email: true,
        //     isActive: true,
        //   },
        // },
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!staff)
      return sendError(res, "Staff member not found", "NOT_FOUND", null, 404);

    return sendSuccess(res, staff);
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/lga-admin/staff/:id
 * Update staff profile or reassign ward/contractor.
 */
export const updateStaff = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let { id } = req.params;
    if (Array.isArray(id)) id = id[0];
    const adminId = req.user!.id;
    const { firstName, lastName, phone, isActive, wardId, contractorId } =
      req.body;

    const staff = await prisma.user.findUnique({ where: { id } });
    if (!staff)
      return sendError(res, "Staff member not found", "NOT_FOUND", null, 404);

    // LGA Admin cannot modify super_admin or lga_admin accounts
    if (["super_admin", "lga_admin"].includes(staff.role)) {
      return sendError(
        res,
        "You cannot modify this account",
        "FORBIDDEN",
        null,
        403,
      );
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(isActive !== undefined && { isActive }),
        ...(wardId !== undefined && { wardId }),
        ...(contractorId !== undefined && { contractorId }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        isActive: true,
        wardId: true,
        contractorId: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "user_updated",
        entity: "User",
        entityId: id,
        userId: adminId,
        details: req.body,
        ipAddress: getIp(req),
      },
    });

    return sendSuccess(res, updated, "Staff updated");
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/lga-admin/accounts/:id/toggle-status
 * Suspend or reactivate an account.
 * Stores suspension metadata — who, when, why.
 */
export const toggleStaffStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { id: requesterId, role: requesterRole } = req.user!;
    const { reason } = req.body;

    if (id === requesterId) {
      return sendError(
        res,
        "You cannot suspend your own account",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    const target = await prisma.user.findUnique({
      where: { id: String(id) },
      select: {
        id: true,
        isActive: true,
        role: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        deletedAt: true,
      },
    });

    if (!target || target.deletedAt) {
      return sendError(res, "Account not found", "NOT_FOUND", null, 404);
    }

    if (
      requesterRole === "lga_admin" &&
      ["super_admin", "lga_admin"].includes(target.role)
    ) {
      return sendError(
        res,
        "You cannot suspend this account",
        "FORBIDDEN",
        null,
        403,
      );
    }

    const nowActive = !target.isActive; // toggling

    // Build update data
    const updateData: any = {
      isActive: nowActive,
      suspendedAt: nowActive ? null : new Date(),
      suspendedById: nowActive ? null : requesterId,
      suspensionReason: nowActive ? null : (reason ?? null),
    };

    // If suspending, increment tokenVersion to invalidate all sessions
    if (!nowActive) {
      updateData.tokenVersion = { increment: 1 };
    }

    const updated = await prisma.user.update({
      where: { id: String(id) },
      data: updateData,
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        suspendedAt: true,
        suspensionReason: true,
        tokenVersion: true,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "user_updated",
        entity: "User",
        entityId: String(id),
        userId: requesterId,
        details: {
          action: nowActive ? "account_reactivated" : "account_suspended",
          reason: reason ?? null,
        },
        ipAddress: getIp(req),
      },
    });

    // --- Send notifications ---
    const fullName = `${target.firstName} ${target.lastName}`;

    if (!nowActive) {
      // Suspension
      try {
        await notify({
          userId: target.id,
          to: { email: target.email, phone: target.phone ?? "" },
          templateKey: "account.accountSuspended", // from your templates
          vars: {
            applicant_name: fullName,
            suspension_reason: reason ?? "No specific reason provided.",
          },
          channels: ["email", "sms"],
        });
      } catch (notifyErr) {
        console.error(
          "[toggleStaffStatus] notify() failed for suspension, continuing anyway:",
          notifyErr,
        );
      }
    } else {
      // Reactivation
      try {
        await notify({
          userId: target.id,
          to: { email: target.email, phone: target.phone ?? "" },
          templateKey: "account.accountReactivated",
          vars: {
            applicant_name: fullName,
          },
          channels: ["email", "sms"],
        });
      } catch (notifyErr) {
        console.error(
          "[toggleStaffStatus] notify() failed for reactivation, continuing anyway:",
          notifyErr,
        );
      }
    }

    return sendSuccess(
      res,
      updated,
      `Account ${nowActive ? "reactivated" : "suspended"} successfully`,
    );
  } catch (err) {
    next(err);
  }
};
// ─────────────────────────────────────────────────────────────
// LGA ADMIN OVERVIEW DASHBOARD
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/lga-admin/overview
 * High-level stats for the LGA Admin dashboard.
 * No financial data — that belongs to Treasurer.
 */
/**
 * GET /api/v1/lga-admin/overview
 *
 * High-level stats for the LGA Admin dashboard.
 * No financial data — that belongs to Treasurer.
 */
export const getAdminOverview = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const [
      totalCitizens,
      totalFieldOfficers,
      pendingApplications,
      totalInvoices,
      recentApplications,
    ] = await Promise.all([
      // StatCard 1 — Citizens
      prisma.user.count({
        where: {
          role: "citizen",
          // deletedAt: null,
          isActive: true,
        },
      }),

      // StatCard 2 — Field Officers
      prisma.user.count({
        where: {
          role: "field_officer",
          // deletedAt: null,
          isActive: true,
        },
      }),

      // StatCard 3 — Pending Applications
      prisma.application.count({
        where: {
          status: {
            in: ["submitted", "under_review"],
          },
        },
      }),

      // StatCard 4 — Total Invoices
      prisma.invoice.count(),

      // Table — Applications awaiting review
      prisma.application.findMany({
        where: {
          status: {
            in: ["submitted", "under_review"],
          },
        },
        take: 10,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          applicationNumber: true,
          status: true,

          applicant: {
            select: {
              firstName: true,
              lastName: true,
            },
          },

          service: {
            select: {
              id: true,
              code: true,
              name: true,
              category: true,
            },
          },
        },
      }),
    ]);

    return sendSuccess(res, {
      stats: {
        citizens: totalCitizens,
        fieldOfficers: totalFieldOfficers,
        pendingApplications,
        totalInvoices,
      },

      recentApplications: recentApplications.map((application) => ({
        id: application.id,
        applicationNumber: application.applicationNumber,

        applicant: application.applicant
          ? `${application.applicant.firstName} ${application.applicant.lastName}`.trim()
          : "—",

        service: application.service
          ? {
              id: application.service.id,
              code: application.service.code,
              name: application.service.name,
              category: application.service.category,
            }
          : null,

        status: application.status,
      })),
    });
  } catch (err) {
    next(err);
  }
};
// Roles LGA Admin can see and manage
const LGA_MANAGEABLE_ROLES: Role[] = [
  "chairman",
  "treasurer",
  "auditor",
  "ward_councillor",
  "contractor",
  "field_officer",
  "business_owner",
  "citizen",
];

// Super admin can manage all including lga_admin
const SUPER_MANAGEABLE_ROLES: Role[] = ["lga_admin", ...LGA_MANAGEABLE_ROLES];

/**
 * GET /api/v1/lga-admin/accounts
 * Returns stat cards + filtered user list in one call.
 * UI reads: counts.total, counts.active, counts.suspended, counts.pending
 * Table reads: id, name, email, phone, role, ward, status, lastLogin, createdAt
 */
export const getAccountsOverview = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id: requesterId, role: requesterRole } = req.user!;
    const search = queryString(req.query.search);
    const roleFilter = queryString(req.query.role) as Role | undefined;
    const page = parseInt(queryString(req.query.page) ?? "1");
    const limit = parseInt(queryString(req.query.limit) ?? "20");
    const skip = (page - 1) * limit;

    // Scope roles based on who is asking
    const allowedRoles =
      requesterRole === "super_admin"
        ? SUPER_MANAGEABLE_ROLES
        : LGA_MANAGEABLE_ROLES;

    const rolesScope: Role[] =
      roleFilter && allowedRoles.includes(roleFilter)
        ? [roleFilter]
        : allowedRoles;

    const baseWhere: any = {
      role: { in: rolesScope },
      // deletedAt: null,
    };

    // Search filter
    if (search) {
      baseWhere.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ];
    }

    const [totalCount, activeCount, suspendedCount, pendingResetCount, users] =
      await Promise.all([
        // Stat: Total
        prisma.user.count({ where: baseWhere }),

        // Stat: Active
        prisma.user.count({
          where: { ...baseWhere, isActive: true, id: { not: requesterId } },
        }),

        // Stat: Suspended
        prisma.user.count({ where: { ...baseWhere, isActive: false } }),

        // Stat: Pending password reset
        prisma.user.count({
          where: { ...baseWhere, passwordResetRequired: true },
        }),

        // Table list
        prisma.user.findMany({
          where: baseWhere,
          skip,
          take: limit,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
            passwordResetRequired: true,
            lastLoginAt: true,
            createdAt: true,
            suspendedAt: true,
            suspensionReason: true,
            // Ward link — for councillors this is their assignedWard
            // For others it's their home ward
            ward: { select: { id: true, name: true } },
        
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

    // Shape users to match UI field names exactly
    const accounts = users.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`,
      email: u.email,
      phone: u.phone ?? "—",
      role: u.role,
      ward: u.ward?.name ?? null,
      status: u.passwordResetRequired
        ? "pending_reset"
        : u.isActive
          ? "active"
          : "suspended",
      lastLogin: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString().split("T")[0],
      suspendedAt: u.suspendedAt?.toISOString() ?? null,
      suspensionReason: u.suspensionReason ?? null,
    }));

    return sendSuccess(res, {
      counts: {
        total: totalCount,
        active: activeCount,
        suspended: suspendedCount,
        pending: pendingResetCount,
      },
      accounts,
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/lga-admin/accounts/:id/reset-password
 * Generates a secure temp password, flags account for reset.
 * TODO Phase 7: Replace tempPassword response with email delivery via Sendgrid/Termii
 */
export const resetAccountPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { id: requesterId, role: requesterRole } = req.user!;

    const target = await prisma.user.findUnique({
      where: { id: String(id) },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        deletedAt: true,
      },
    });

    if (!target || target.deletedAt) {
      return sendError(res, "Account not found", "NOT_FOUND", null, 404);
    }

    if (
      requesterRole === "lga_admin" &&
      ["super_admin", "lga_admin"].includes(target.role)
    ) {
      return sendError(
        res,
        "You cannot reset this account password",
        "FORBIDDEN",
        null,
        403,
      );
    }

    if (id === requesterId) {
      return sendError(
        res,
        "Use your profile settings to reset your own password",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    const tempPassword = generateTempPassword(12); // using your helper
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    await prisma.user.update({
      where: { id: String(id) },
      data: {
        password: hashedPassword,
        passwordResetRequired: true,
        tokenVersion: { increment: 1 }, // invalidate existing sessions
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "user_updated",
        entity: "User",
        entityId: String(id),
        userId: requesterId,
        details: {
          action: "password_reset",
          resetBy: requesterId,
          targetEmail: target.email,
        },
        ipAddress: getIp(req),
      },
    });

    // --- Send notifications ---
    const fullName = `${target.firstName} ${target.lastName}`;
    try {
      await notify({
        userId: target.id,
        to: { email: target.email, phone: target.phone ?? "" },
        templateKey: "account.passwordResetByAdmin",
        vars: {
          applicant_name: fullName,
          temp_password: tempPassword,
        },
        channels: ["email", "sms"],
      });
    } catch (notifyErr) {
      console.error(
        "[resetAccountPassword] notify() failed, continuing anyway:",
        notifyErr,
      );
    }

    return sendSuccess(res, {
      message: `Password reset for ${fullName}`,
      // We keep the temporary password in response for development,
      // but it's also sent via channels. Remove in production if desired.
      temporaryPassword: tempPassword,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/lga-admin/contractors
 * Returns stat cards + contractor grid + all field agents tab in one call.
 */
export const getContractorsOverview = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const search = queryString(req.query.search);

    const where: any = {
      role: "contractor",
      deletedAt: null,
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [contractors, totalAgents, revenueAgg] = await Promise.all([
      // All contractors with their agents and revenue
      prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          address: true,
          isActive: true,
          commissionRate: true,
          createdAt: true,
          lastLoginAt: true,

          // Their agents (field officers + agents directly under them)
          agents: {
            where: { deletedAt: null },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              role: true,
              isActive: true,
              ward: { select: { id: true, name: true } },
              // Revenue collected by this agent's officers
              invoicesAssignedTo: {
                select: { amountPaid: true },
              },
            },
          },

          // ✅ FIX 1: Actually fetch the directly assigned wards!
          assignedContractorWards: {
            select: {
              id: true,
              name: true,
            },
          },

          // Permitted levy configs (scope of collection)
          permittedLevies: {
            select: {
              id: true,
              name: true,
              category: { select: { name: true, slug: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),

      // Total field agents across all contractors
      prisma.user.count({
        where: {
          role: "agent",
          deletedAt: null,
          contractorId: { not: null },
        },
      }),

      // Total revenue collected via contractor-assigned officers
      prisma.invoice.aggregate({
        where: {
          assignedOfficer: { contractorId: { not: null } },
        },
        _sum: { amountPaid: true },
      }),
    ]);

    // Shape contractors for the grid tab
    const contractorList = contractors.map((c) => {
      const agentCount = c.agents.length;
      const collected = c.agents.reduce((sum, a) => {
        return (
          sum +
          a.invoicesAssignedTo.reduce((s, inv) => s + Number(inv.amountPaid), 0)
        );
      }, 0);

      return {
        id: c.id,
        companyName: `${c.firstName} ${c.lastName}`,
        contactName: `${c.firstName} ${c.lastName}`,
        email: c.email,
        phone: c.phone ?? "—",
        address: c.address ?? "—",
        commission: c.commissionRate ?? 0,
        status: c.isActive ? "active" : "suspended",
        startDate: c.createdAt.toISOString().split("T")[0],
        lastLogin: c.lastLoginAt?.toISOString() ?? null,
        agentCount,
        collected,

        // Scope = permitted levy names (This was already working correctly)
        scope: c.permittedLevies.map((l) => l.category?.name ?? l.name),

        // ✅ FIX 2: Map directly from assignedContractorWards instead of agents!
        wards: c.assignedContractorWards.map((w) => w.name),
      };
    });

    // Shape all field agents for the agents tab
    const allAgents = await prisma.user.findMany({
      where: {
        role: "agent",
        deletedAt: null,
        contractorId: { not: null },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        isActive: true,
        ward: { select: { name: true } },
        contractor: { select: { id: true, firstName: true, lastName: true } },
        invoicesAssignedTo: {
          select: { amountPaid: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return sendSuccess(res, {
      stats: {
        totalContractors: contractors.length,
        activeContractors: contractors.filter((c) => c.isActive).length,
        totalAgentsDeployed: totalAgents,
        totalRevenueViaContractors: Number(revenueAgg._sum.amountPaid ?? 0),
      },
      contractors: contractorList,
      fieldAgents: allAgents.map((a) => ({
        id: a.id,
        name: `${a.firstName} ${a.lastName}`,
        email: a.email,
        phone: a.phone ?? "—",
        ward: a.ward?.name ?? "—",
        status: a.isActive ? "active" : "suspended",
        contractorId: a.contractor?.id ?? null,
        contractorName: a.contractor
          ? `${a.contractor.firstName} ${a.contractor.lastName}`
          : "LGA Direct",
        totalCollected: a.invoicesAssignedTo.reduce(
          (s, inv) => s + Number(inv.amountPaid),
          0,
        ),
      })),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/lga-admin/contractors
 * Create a new contractor account.
 * UI sends: companyName, contactName, email, phone, address, commission, scope[], wards[]
 *
 * Note: companyName is stored via firstName (company) + lastName (contact split)
 * since User model doesn't have a companyName field.
 * A cleaner approach would be to add companyName to User — flag for schema update.
 */
export const createContractor = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id: adminId } = req.user!;
    const {
      companyName,
      contactName,
      email,
      phone,
      address,
      commission = 0,
      scopeIds = [], // array of levyConfig IDs
      wardIds = [], // array of ward IDs (for reference — not enforced at DB level yet)
    } = req.body;

    // console.log(scopeIds,wardIds,"♾️")
    if (!companyName || !contactName || !email) {
      return sendError(
        res,
        "companyName, contactName and email are required",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      return sendError(res, "Email already registered", "CONFLICT", null, 409);

    // Split contactName into first/last for the User model
    const nameParts = contactName.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || companyName;

    const tempPassword = crypto.randomBytes(6).toString("hex");
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const generatePhone = () =>
      "0" +
      Array.from({ length: 10 }, () => crypto.randomInt(0, 10).toString()).join(
        "",
      );

    // 1. Fetch only the IDs that legitimately exist in your database right now

    // Look up all specific sub-levy configurations belonging to the provided category IDs
    const validLevies = await prisma.levyConfig.findMany({
      where: {
        categoryId: { in: scopeIds || [] }, // 🚀 Querying by category link instead of direct ID
      },
      select: { id: true },
    });
    const validWards = await prisma.ward.findMany({
      where: { id: { in: wardIds || [] } },
      select: { id: true },
    });

    // 2. Run your creation statement using the sanitized verification outputs
    const contractor = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        phone: phone ?? generatePhone(),
        address,
        password: hashedPassword,
        role: "contractor",
        commissionRate: commission,
        createdById: adminId,

        // Connect only the verified records that actually exist in the DB tables
        ...(validLevies.length > 0 && {
          permittedLevies: {
            connect: validLevies.map((l) => ({ id: l.id })),
          },
        }),
        ...(validWards.length > 0 && {
          assignedContractorWards: {
            connect: validWards.map((w) => ({ id: w.id })),
          },
        }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        commissionRate: true,
        // Add these two blocks right here:
        assignedContractorWards: {
          select: { id: true, name: true, code: true },
        },
        permittedLevies: {
          select: { id: true, name: true, amount: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "user_created",
        entity: "User",
        entityId: contractor.id,
        userId: adminId,
        details: { role: "contractor", companyName, email, commission },
        ipAddress: getIp(req),
      },
    });

    // TODO Phase 7: Send welcome email with tempPassword to contractor
    // await emailService.sendWelcome({
    //   to:       email,
    //   name:     contactName,
    //   company:  companyName,
    //   password: tempPassword,
    //   loginUrl: process.env.APP_URL + '/login',
    // });

    return sendSuccess(
      res,
      {
        contractor,
        // temporaryPassword: tempPassword,
        notice:
          "Share credentials with contractor securely. Remove this after Phase 7 email is live.",
      },
      "Contractor created successfully",
      201,
    );
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/lga-admin/contractors/:contractorId/agents
 * Add a field agent under a specific contractor.
 * UI sends from AddAgentDialog: name, email, phone, ward (name), levy (name)
 */
export const addAgentToContractor = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { contractorId } = req.params;
    const { id: adminId } = req.user!;
    const { name, email, phone, wardId, levyConfigId } = req.body;

    if (!name || !email) {
      return sendError(
        res,
        "Name and email are required",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    // Verify contractor exists
    const contractor = await prisma.user.findUnique({
      where: { id: String(contractorId), role: "contractor", deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!contractor) {
      return sendError(res, "Contractor not found", "NOT_FOUND", null, 404);
    }

    // Verify ward if provided
    if (wardId) {
      const ward = await prisma.ward.findUnique({ where: { id: wardId } });
      if (!ward)
        return sendError(res, "Ward not found", "NOT_FOUND", null, 404);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      return sendError(res, "Email already registered", "CONFLICT", null, 409);

    const nameParts = name.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || "";

    const tempPassword = crypto.randomBytes(6).toString("hex");
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    let validLevyConfigs: { id: string }[] = [];
    if (levyConfigId) {
      validLevyConfigs = await prisma.levyConfig.findMany({
        where: {
          categoryId: levyConfigId,
        },
        select: { id: true },
      });

      if (validLevyConfigs.length === 0) {
        return sendError(
          res,
          "The selected Levy Category has no active sub-levy configurations",
          "NOT_FOUND",
          null,
          404,
        );
      }
    }

    const agent = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        phone,
        password: hashedPassword,
        role: "agent",
        contractorId: String(contractorId), // links to contractor
        createdById: adminId,
        ...(wardId && { wardId }),
        // Connect levy config if provided
        ...(validLevyConfigs.length > 0 && {
          permittedLevies: {
            connect: validLevyConfigs.map((config) => ({ id: config.id })),
          },
        }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        ward: { select: { name: true } },
        contractor: { select: { id: true, firstName: true, lastName: true } },
        permittedLevies: { select: { id: true, name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "user_created",
        entity: "User",
        entityId: agent.id,
        userId: adminId,
        details: { role: "field_officer", contractorId, email },
        ipAddress: getIp(req),
      },
    });

    // TODO Phase 7: Send welcome email/SMS to agent with tempPassword

    return sendSuccess(
      res,
      {
        agent,
        // temporaryPassword: tempPassword,
      },
      `Field agent added to contractor`,
      201,
    );
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/permits/admin/:id/revoke
// LGA Admin / Super Admin only
export const revokePermit = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;
    const { reason } = req.body; // optional reason

    const permit = await prisma.permit.findUnique({
      where: { id: String(id) },
      include: {
        business: { select: { businessName: true, wardId: true } },
      },
    });

    if (!permit)
      return sendError(res, "Permit not found", "NOT_FOUND", null, 404);

    // Can only revoke active permits
    if (!["issued", "paid"].includes(permit.status)) {
      return sendError(
        res,
        `Cannot revoke a permit with status "${permit.status}". Only issued or paid permits can be revoked.`,
        "BAD_REQUEST",
        null,
        400,
      );
    }

    const revoked = await prisma.permit.update({
      where: { id: String(id) },
      data: { status: "revoked", revokeReason: reason },
      include: {
        business: { select: { businessName: true } },
        config: { select: { name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "permit_revoked",
        entity: "Permit",
        entityId: String(id),
        userId: adminId,
        details: {
          permitNumber: permit.permitNumber,
          businessName: permit.business.businessName,
          reason: reason ?? "No reason provided",
          previousStatus: permit.status,
        },
        ipAddress: getIp(req),
      },
    });

    // TODO Phase 7: Notify business owner of revocation via SMS/email
    // using permitTemplates.permitSuspended template

    return sendSuccess(
      res,
      {
        id: revoked.id,
        permitNumber: permit.permitNumber,
        status: revoked.status,
        businessName: revoked.business.businessName,
        permitType: revoked.config?.name ?? "—",
        reason: reason ?? null,
      },
      `Permit ${permit.permitNumber} has been revoked`,
    );
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/permits/admin
// LGA Admin / Super Admin — all permits with filters
export const getAllPermits = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const search = queryString(req.query.search);
    const wardId = queryString(req.query.wardId);
    const status = queryString(req.query.status) as PermitStatus | undefined;
    const page = parseInt(queryString(req.query.page) ?? "1");
    const limit = parseInt(queryString(req.query.limit) ?? "20");
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (wardId) where.business = { wardId };
    if (search) {
      where.OR = [
        { permitNumber: { contains: search, mode: "insensitive" } },
        {
          business: { businessName: { contains: search, mode: "insensitive" } },
        },
        { business: { ownerName: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [permits, total] = await Promise.all([
      prisma.permit.findMany({
        where,
        skip,
        take: limit,
        include: {
          business: {
            select: {
              id: true,
              businessName: true,
              ownerName: true,
              phone: true,
              ward: { select: { id: true, name: true } },
            },
          },
          config: { select: { name: true, baseAmount: true } },
          issuedBy: { select: { id: true, firstName: true, lastName: true } },
          invoice: {
            select: {
              id: true,
              status: true,
              amountPaid: true,
              totalAmount: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.permit.count({ where }),
    ]);

    // Stat card aggregates
    const [issuedCount, pendingCount, revenueAgg, activeOfficers] =
      await Promise.all([
        prisma.permit.count({ where: { status: "issued" } }),
        prisma.permit.count({
          where: { status: { in: ["pending_payment", "paid"] } },
        }),
        prisma.invoice.aggregate({
          where: { permit: { isNot: null }, status: { in: ["paid"] } },
          _sum: { amountPaid: true },
        }),
        prisma.user.count({
          where: { role: "field_officer", isActive: true, deletedAt: null },
        }),
      ]);

    return sendSuccess(res, {
      stats: {
        issued: issuedCount,
        pending: pendingCount,
        totalRevenue: Number(revenueAgg._sum.amountPaid ?? 0),
        activeOfficers,
      },
      permits: permits.map((p) => ({
        id: p.id,
        permitNumber: p.permitNumber,
        status: p.status,
        validFrom: p.validFrom,
        validTo: p.validTo,
        businessName: p.business.businessName,
        ownerName: p.business.ownerName,
        ward: p.business.ward?.name ?? "—",
        wardId: p.business.ward?.id ?? null,
        fee: Number(p.config?.baseAmount ?? p.invoice?.totalAmount ?? 0),
        amountPaid: Number(p.invoice?.amountPaid ?? 0),
        permitType: p.config?.name ?? "—",
        issuedBy: p.issuedBy
          ? `${p.issuedBy.firstName} ${p.issuedBy.lastName}`
          : null,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};
