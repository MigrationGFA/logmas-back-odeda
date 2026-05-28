"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshToken = exports.googleLogin = exports.getMe = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../../utils/prisma");
const jwt_1 = require("../../utils/jwt");
const response_1 = require("../../utils/response");
const google_auth_library_1 = require("google-auth-library");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = __importDefault(require("../../config/env"));
const register = async (req, res, next) => {
    try {
        const { email, password, firstName, lastName, role } = req.body;
        // Only these two roles can self-register
        const allowedSelfRegisterRoles = ["citizen", "business_owner"];
        const assignedRole = role && allowedSelfRegisterRoles.includes(role) ? role : "citizen";
        const existingUser = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (existingUser)
            return (0, response_1.sendError)(res, "Email already registered", "CONFLICT", null, 409);
        const hashedPassword = await bcryptjs_1.default.hash(password, 12); // bump to 12 rounds
        const user = await prisma_1.prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                firstName,
                lastName,
                role: assignedRole,
            },
        });
        if (!user || !(await bcryptjs_1.default.compare(password, user.password))) {
            // Log failed attempt before returning
            await prisma_1.prisma.auditLog.create({
                data: { action: "login_failed", details: JSON.stringify({ email }), ipAddress: req.ip },
            });
            return (0, response_1.sendError)(res, "Invalid credentials", "UNAUTHORIZED", null, 401);
        }
        // Check if account is suspended
        // If your user model supports account suspension, ensure 'isActive' exists in the schema and is selected here.
        // Otherwise, remove or adjust this check.
        if (user.deletedAt !== null) {
            return (0, response_1.sendError)(res, "Account suspended. Contact administrator.", "FORBIDDEN", null, 403);
        }
        // Log successful login
        await prisma_1.prisma.auditLog.create({
            data: {
                action: "login",
                userId: user.id,
                entity: "User",
                entityId: user.id,
                ipAddress: req.ip,
            },
        });
        const { password: _, ...userResponse } = user;
        return (0, response_1.sendSuccess)(res, userResponse, null, 201);
    }
    catch (err) {
        next(err);
    }
};
exports.register = register;
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await prisma_1.prisma.user.findFirst({
            where: { email, deletedAt: null },
        });
        if (!user || !(await bcryptjs_1.default.compare(password, user.password))) {
            return (0, response_1.sendError)(res, "Invalid verification credentials credentials provided", "UNAUTHORIZED", null, 401);
        }
        const accessToken = (0, jwt_1.generateAccessToken)({
            id: user.id,
            role: user.role,
            email: user.email,
        });
        const refreshToken = (0, jwt_1.generateRefreshToken)({ id: user.id });
        return (0, response_1.sendSuccess)(res, { accessToken, refreshToken, role: user.role });
    }
    catch (err) {
        next(err);
    }
};
exports.login = login;
const getMe = async (req, res, next) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({ where: { id: req.user?.id } });
        if (!user)
            return (0, response_1.sendError)(res, "User record profile could not be localized", "NOT_FOUND", null, 404);
        const { password: _, ...userResponse } = user;
        return (0, response_1.sendSuccess)(res, userResponse);
    }
    catch (err) {
        next(err);
    }
};
exports.getMe = getMe;
/**
 * NEW: Google Authentication Endpoint Controller
 * Decodes the frontend client's validated payload credentials tokens.
 */
// auth.controller.ts
const googleClient = new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const googleLogin = async (req, res, next) => {
    try {
        const { token } = req.body;
        // Actually verify the token with Google
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            return (0, response_1.sendError)(res, "Invalid Google token", "BAD_REQUEST", null, 400);
        }
        if (!payload.email_verified) {
            return (0, response_1.sendError)(res, "Google email not verified", "UNAUTHORIZED", null, 401);
        }
        const email = payload.email.toLowerCase();
        const firstName = payload.given_name || "Citizen";
        const lastName = payload.family_name || "User";
        let user = await prisma_1.prisma.user.findFirst({
            where: { email, deletedAt: null },
        });
        if (!user) {
            const fallbackPassword = await bcryptjs_1.default.hash(crypto.randomUUID(), 12);
            user = await prisma_1.prisma.user.create({
                data: {
                    email,
                    firstName,
                    lastName,
                    password: fallbackPassword,
                    role: "citizen",
                },
            });
        }
        const accessToken = (0, jwt_1.generateAccessToken)({
            id: user.id,
            role: user.role,
            email: user.email,
        });
        const refreshToken = (0, jwt_1.generateRefreshToken)({ id: user.id });
        return (0, response_1.sendSuccess)(res, {
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
    }
    catch (err) {
        next(err);
    }
};
exports.googleLogin = googleLogin;
// auth.controller.ts
const refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken)
            return (0, response_1.sendError)(res, 'Refresh token required', 'BAD_REQUEST', null, 400);
        const decoded = jsonwebtoken_1.default.verify(refreshToken, env_1.default.JWT_REFRESH_SECRET);
        const user = await prisma_1.prisma.user.findUnique({ where: { id: decoded.id } });
        if (!user || !user.isActive || user.deletedAt) {
            return (0, response_1.sendError)(res, 'Invalid refresh token', 'UNAUTHORIZED', null, 401);
        }
        const accessToken = (0, jwt_1.generateAccessToken)({ id: user.id, role: user.role, email: user.email });
        return (0, response_1.sendSuccess)(res, { accessToken });
    }
    catch (err) {
        return (0, response_1.sendError)(res, 'Invalid or expired refresh token', 'UNAUTHORIZED', null, 401);
    }
};
exports.refreshToken = refreshToken;
// auth.routes.ts
