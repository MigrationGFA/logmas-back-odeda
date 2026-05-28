"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleAuthSchema = exports.loginSchema = exports.registerSchema = void 0;
// auth.validation.ts
const zod_1 = require("zod");
exports.registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters long'),
    firstName: zod_1.z.string().min(1),
    lastName: zod_1.z.string().min(1),
    // role: z.enum(['business_owner', 'citizen']).optional()
    role: zod_1.z.enum(['super_admin', 'lga_admin', 'chairman', 'treasurer', 'auditor', 'contractor', 'field_officer', 'citizen', "business_owner"]).optional()
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string()
});
exports.googleAuthSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Google ID token or credential string is required')
});
