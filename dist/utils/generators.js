"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReference = exports.generateQrToken = exports.generateVerificationCode = exports.generateReceiptNumber = void 0;
// src/utils/generators.ts
const crypto_1 = __importDefault(require("crypto"));
/**
 * Generates a human-readable prefixed reference number.
 * e.g. CERT-2025-A3F9K2 or INV-2025-X8P2M1
 */
const generateReceiptNumber = (prefix) => {
    const year = new Date().getFullYear();
    const random = crypto_1.default.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
    return `${prefix}-${year}-${random}`;
};
exports.generateReceiptNumber = generateReceiptNumber;
/**
 * Generates a short alphanumeric verification code for public lookup.
 * e.g. A3F9K2XP
 */
const generateVerificationCode = () => {
    return crypto_1.default.randomBytes(6).toString('hex').toUpperCase();
};
exports.generateVerificationCode = generateVerificationCode;
/**
 * Generates a longer secure QR token (used in QR code payload).
 * e.g. 3f2a1b4c8d9e0f1a2b3c4d5e6f7a8b9c
 */
const generateQrToken = () => {
    return crypto_1.default.randomBytes(24).toString('hex');
};
exports.generateQrToken = generateQrToken;
/**
 * Generates a unique invoice/receipt reference string.
 */
const generateReference = (prefix = 'REF') => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto_1.default.randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
};
exports.generateReference = generateReference;
