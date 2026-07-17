// auth.controller.ts
import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../../utils/prisma";
import { generateAccessToken, generateRefreshToken } from "../../utils/jwt";
import { sendSuccess, sendError } from "../../utils/response";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import env from "../../config/env";
import { notify } from "../notification/notification.service";
import { getIp } from "../complaints/complaints.controller";

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    // Only these two roles can self-register
    const allowedSelfRegisterRoles = ["citizen", "business_owner"];
    const assignedRole =
      role && allowedSelfRegisterRoles.includes(role) ? role : "citizen";

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
      return sendError(res, "Email already registered", "CONFLICT", null, 409);

    const hashedPassword = await bcrypt.hash(password, 12); // bump to 12 rounds
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: assignedRole,
      },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      // Log failed attempt before returning
      await prisma.auditLog.create({
        data: {
          action: "login_failed",
          details: JSON.stringify({ email }),
          ipAddress: req.ip,
        },
      });
      return sendError(res, "Invalid credentials", "UNAUTHORIZED", null, 401);
    }

    // Check if account is suspended
    // If your user model supports account suspension, ensure 'isActive' exists in the schema and is selected here.
    // Otherwise, remove or adjust this check.
    if (user.deletedAt !== null) {
      return sendError(
        res,
        "Account suspended. Contact administrator.",
        "FORBIDDEN",
        null,
        403,
      );
    }

    // Log successful login
    await prisma.auditLog.create({
      data: {
        action: "login",
        userId: user.id,
        entity: "User",
        entityId: user.id,
        ipAddress: req.ip,
      },
    });

    const { password: _, ...userResponse } = user;
    return sendSuccess(res, userResponse, null, 201);
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return sendError(
        res,
        "Invalid credentials provided",
        "UNAUTHORIZED",
        null,
        401,
      );
    }

    // Check if account is suspended
    if (!user.isActive) {
      return sendError(
        res,
        "Account suspended. Contact LGA Secretariat.",
        "SUSPENDED",
        null,
        403,
      );
    }

    // Get fresh tokenVersion
    const tokenVersion = user.tokenVersion;

    const accessToken = generateAccessToken({
      id: user.id,
      role: user.role,
      email: user.email,
      wardId: user.wardId,
      tokenVersion,
    });
    const refreshToken = generateRefreshToken({ id: user.id });
    console.log(accessToken, "❤️");

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return sendSuccess(res, {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        passwordResetRequired: user.passwordResetRequired, // NEW
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.id },
      include: { ward: { select: { id: true, name: true } } },
    });
    if (!user)
      return sendError(
        res,
        "User record profile could not be localized",
        "NOT_FOUND",
        null,
        404,
      );
    const { password: _, ...userResponse } = user;
    return sendSuccess(res, userResponse);
  } catch (err) {
    next(err);
  }
};

/**
 * NEW: Google Authentication Endpoint Controller
 * Decodes the frontend client's validated payload credentials tokens.
 */
// auth.controller.ts
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleLogin = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { token } = req.body;

    // Actually verify the token with Google
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return sendError(res, "Invalid Google token", "BAD_REQUEST", null, 400);
    }

    if (!payload.email_verified) {
      return sendError(
        res,
        "Google email not verified",
        "UNAUTHORIZED",
        null,
        401,
      );
    }

    const email = payload.email.toLowerCase();
    const firstName = payload.given_name || "Citizen";
    const lastName = payload.family_name || "User";

    let user = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    if (!user) {
      const fallbackPassword = await bcrypt.hash(crypto.randomUUID(), 12);
      user = await prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          password: fallbackPassword,
          role: "citizen",
        },
      });
    }

    const accessToken = generateAccessToken({
      id: user.id,
      role: user.role,
      email: user.email,
      // wardId: user.wardId,
      tokenVersion: user.tokenVersion, // NEW
    });
    const refreshToken = generateRefreshToken({ id: user.id });

    return sendSuccess(res, {
      accessToken,
      refreshToken,
      role: user.role,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (err) {
    next(err);
  }
};

// auth.controller.ts
export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return sendError(res, "Refresh token required", "BAD_REQUEST", null, 400);

    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as {
      id: string;
    };
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user || !user.isActive || user.deletedAt) {
      return sendError(res, "Invalid refresh token", "UNAUTHORIZED", null, 401);
    }

    const accessToken = generateAccessToken({
      id: user.id,
      role: user.role,
      email: user.email,
      tokenVersion: user.tokenVersion, // NEW
    });
    return sendSuccess(res, { accessToken });
  } catch (err) {
    return sendError(
      res,
      "Invalid or expired refresh token",
      "UNAUTHORIZED",
      null,
      401,
    );
  }
};

// PUT /api/v1/users/profile
// PUT /api/v1/users/profile
export const updateUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // 1. Ensure the session contains a valid user context
    if (!req.user || !req.user.id) {
      return sendError(
        res,
        "Unauthorized context binding",
        "UNAUTHORIZED",
        null,
        401,
      );
    }

    const userId = req.user.id;
    const {
      firstName,
      lastName,
      phone,
      notifyByEmail,
      notifyBySms,
      notifyByInApp,
    } = req.body;

    // 2. Input validation checks for text fields
    if (firstName !== undefined && typeof firstName !== "string") {
      return sendError(
        res,
        "First name must be a valid string",
        "BAD_REQUEST",
        null,
        400,
      );
    }
    if (lastName !== undefined && typeof lastName !== "string") {
      return sendError(
        res,
        "Last name must be a valid string",
        "BAD_REQUEST",
        null,
        400,
      );
    }
    if (phone !== undefined && typeof phone !== "string") {
      return sendError(
        res,
        "Phone number must be a valid string",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    // 3. Input validation checks for notification booleans
    if (notifyByEmail !== undefined && typeof notifyByEmail !== "boolean") {
      return sendError(
        res,
        "notifyByEmail must be a boolean value",
        "BAD_REQUEST",
        null,
        400,
      );
    }
    if (notifyBySms !== undefined && typeof notifyBySms !== "boolean") {
      return sendError(
        res,
        "notifyBySms must be a boolean value",
        "BAD_REQUEST",
        null,
        400,
      );
    }
    if (notifyByInApp !== undefined && typeof notifyByInApp !== "boolean") {
      return sendError(
        res,
        "notifyByInApp must be a boolean value",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    // 4. Duplicate phone number check - ONLY if phone is provided AND not empty
    if (phone && phone.trim() !== "") {
      const trimmedPhone = phone.trim();

      const duplicatePhone = await prisma.user.findFirst({
        where: {
          phone: trimmedPhone,
          id: { not: userId },
          // Exclude users with empty/null phone numbers
          NOT: {
            OR: [{ phone: null }, { phone: "" }],
          },
        },
      });

      if (duplicatePhone) {
        return sendError(
          res,
          "This phone number is already registered to another account",
          "CONFLICT",
          null,
          409,
        );
      }
    }

    // 5. Prepare update data
    const updateData: any = {};

    // Text fields - only include if provided
    if (firstName !== undefined) {
      updateData.firstName = firstName.trim();
    }
    if (lastName !== undefined) {
      updateData.lastName = lastName.trim();
    }
    if (phone !== undefined) {
      // If phone is empty string or null, set to null instead of empty string
      updateData.phone = phone.trim() !== "" ? phone.trim() : null;
    }

    // Boolean fields - only include if provided
    if (notifyByEmail !== undefined) {
      updateData.notifyByEmail = notifyByEmail;
    }
    if (notifyBySms !== undefined) {
      updateData.notifyBySms = notifyBySms;
    }
    if (notifyByInApp !== undefined) {
      updateData.notifyByInApp = notifyByInApp;
    }

    // 6. Update user record
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // 7. Respond with the clean updated model profile
    return sendSuccess(
      res,
      updatedUser,
      "Settings and profile updated successfully",
    );
  } catch (err) {
    next(err);
  }
};

// src/auth/password.controller.ts
//
// TODO: fix import paths (prisma, sendSuccess/sendError, notify) to match your project

const RESET_TOKEN_TTL_MINUTES = 30;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// POST /api/v1/auth/forgot-password
// body: { email }
export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email } = req.body;
    if (!email)
      return sendError(res, "Email is required", "BAD_REQUEST", null, 400);

    const user = await prisma.user.findUnique({ where: { email } });
    // Per your spec: the account must exist — explicit error if not, not the usual
    // "always say success" security pattern. Worth knowing this lets someone probe
    // which emails have accounts; acceptable tradeoff if that's intentional here.
    if (!user) {
      return sendError(
        res,
        "No account found with that email",
        "NOT_FOUND",
        null,
        404,
      );
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(
      Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000,
    );

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: tokenHash,
        passwordResetTokenExpiresAt: expiresAt,
      },
    });

    const resetLink = `${process.env.PAYSTACK_CALLBACK_URL}/reset-password?token=${rawToken}`; // TODO: confirm your frontend route

    try {
      await notify({
        userId: user.id,
        to: { email: user.email, phone: user.phone ?? undefined },
        templateKey: "account.passwordReset",
        vars: {
          reset_link: resetLink,
          expiration_time: `${RESET_TOKEN_TTL_MINUTES} minutes`,
        },
        channels: ["email"], // sms omitted — no sms variant on this template currently
      });
    } catch (notifyErr) {
      console.error(
        "[forgotPassword] notify() failed, continuing anyway:",
        notifyErr,
      );
    }

    return sendSuccess(res, {
      message: "Password reset link sent to your email",
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/auth/reset-password
// body: { token, newPassword, confirmPassword }
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
      return sendError(
        res,
        "token, newPassword, and confirmPassword are required",
        "BAD_REQUEST",
        null,
        400,
      );
    }
    if (newPassword !== confirmPassword) {
      return sendError(res, "Passwords do not match", "BAD_REQUEST", null, 400);
    }
    if (newPassword.length < 8) {
      return sendError(
        res,
        "Password must be at least 8 characters",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    const tokenHash = hashToken(token);
    const user = await prisma.user.findUnique({
      where: { passwordResetToken: tokenHash },
    });

    if (
      !user ||
      !user.passwordResetTokenExpiresAt ||
      user.passwordResetTokenExpiresAt < new Date()
    ) {
      return sendError(
        res,
        "Reset link is invalid or has expired",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
        passwordResetRequired: false,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "user_updated",
        entity: "User",
        entityId: user.id,
        userId: user.id,
        details: { action: "password_reset_via_link" },
        ipAddress: getIp(req), // TODO: confirm this util exists in this file's scope
      },
    });

    try {
      await notify({
        userId: user.id,
        to: { email: user.email, phone: user.phone ?? undefined },
        templateKey: "account.passwordChanged",
        vars: { applicant_name: user.firstName },
        channels: ["email", "sms"],
      });
    } catch (notifyErr) {
      console.error(
        "[resetPassword] notify() failed, continuing anyway:",
        notifyErr,
      );
    }

    return sendSuccess(res, {
      message: "Password has been reset successfully. You can now log in.",
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/auth/change-password
// Requires auth. body: { oldPassword, newPassword, confirmPassword }
export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.id;
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!oldPassword || !newPassword || !confirmPassword) {
      return sendError(
        res,
        "oldPassword, newPassword, and confirmPassword are required",
        "BAD_REQUEST",
        null,
        400,
      );
    }
    if (newPassword !== confirmPassword) {
      return sendError(
        res,
        "New passwords do not match",
        "BAD_REQUEST",
        null,
        400,
      );
    }
    if (newPassword.length < 8) {
      return sendError(
        res,
        "Password must be at least 8 characters",
        "BAD_REQUEST",
        null,
        400,
      );
    }
    if (oldPassword === newPassword) {
      return sendError(
        res,
        "New password must be different from current password",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return sendError(res, "User not found", "NOT_FOUND", null, 404);

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return sendError(
        res,
        "Current password is incorrect",
        "BAD_REQUEST",
        null,
        400,
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        passwordResetRequired: false,
        tokenVersion: { increment: 1 },
      },
    });

        const newToken = generateAccessToken({
      id: userId,
      role: req.user!.role,
      email: req.user!.email,
      wardId: req.user!.wardId,
      tokenVersion: (await prisma.user.findUnique({ where: { id: userId }, select: { tokenVersion: true } }))!.tokenVersion,
    });

    await prisma.auditLog.create({
      data: {
        action: "user_updated",
        entity: "User",
        entityId: userId,
        userId,
        details: { action: "password_changed" },
        ipAddress: getIp(req),
      },
    });

    try {
      await notify({
        userId: user.id,
        to: { email: user.email, phone: user.phone ?? undefined },
        templateKey: "account.passwordChanged",
        vars: { applicant_name: user.firstName },
        channels: ["email", "sms"],
      });
    } catch (notifyErr) {
      console.error(
        "[changePassword] notify() failed, continuing anyway:",
        notifyErr,
      );
    }

    return sendSuccess(res, { message: "Password changed successfully",accessToken: newToken, });
  } catch (err) {
    next(err);
  }
};
