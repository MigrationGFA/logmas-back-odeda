"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDirectoryExists = exports.UPLOAD_FOLDER_MAP = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Define a strict whitelist of allowed upload categories to protect your cPanel directory structure
exports.UPLOAD_FOLDER_MAP = {
    passports: 'public/uploads/passports',
    complaints: 'public/uploads/complaints',
    permits: 'public/uploads/permits',
    documents: 'public/uploads/documents'
};
/**
 * Ensures that the target directory exists on the cPanel disk.
 * If it doesn't, it recursively creates it.
 */
const ensureDirectoryExists = (folderPath) => {
    const resolvedPath = path_1.default.resolve(folderPath);
    if (!fs_1.default.existsSync(resolvedPath)) {
        fs_1.default.mkdirSync(resolvedPath, { recursive: true });
    }
};
exports.ensureDirectoryExists = ensureDirectoryExists;
