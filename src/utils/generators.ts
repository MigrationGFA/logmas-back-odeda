// src/utils/generators.ts
import crypto from 'crypto';

/**
 * Generates a human-readable prefixed reference number.
 * e.g. CERT-2025-A3F9K2 or INV-2025-X8P2M1
 */
export const generateReceiptNumber = (prefix: string): string => {
  const year = new Date().getFullYear();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
  return `${prefix}-${year}-${random}`;
};

/**
 * Generates a short alphanumeric verification code for public lookup.
 * e.g. A3F9K2XP
 */
export const generateVerificationCode = (): string => {
  return crypto.randomBytes(6).toString('hex').toUpperCase();
};

/**
 * Generates a longer secure QR token (used in QR code payload).
 * e.g. 3f2a1b4c8d9e0f1a2b3c4d5e6f7a8b9c
 */
export const generateQrToken = (): string => {
  return crypto.randomBytes(24).toString('hex');
};

/**
 * Generates a unique invoice/receipt reference string.
 */
export const generateReference = (prefix: string = 'REF'): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};