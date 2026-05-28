"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const auth_middleware_1 = require("../../middleware/auth.middleware");
const response_1 = require("../../utils/response");
const fileStorage_1 = require("../../utils/fileStorage");
const router = (0, express_1.Router)();
// Configure custom Multer storage engine
const diskStorage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        // Read the type parameter from the request query string (e.g., ?type=passports)
        const uploadType = req.query.type || 'documents';
        const targetFolder = fileStorage_1.UPLOAD_FOLDER_MAP[uploadType] || fileStorage_1.UPLOAD_FOLDER_MAP.documents;
        // Auto-create folder structural paths on cPanel dynamically if missing
        (0, fileStorage_1.ensureDirectoryExists)(targetFolder);
        cb(null, targetFolder);
    },
    filename: (req, file, cb) => {
        // Generate a secure unique name: timestamp + random bytes + original extension
        const uniqueSuffix = `${Date.now()}-${crypto_1.default.randomBytes(4).toString('hex')}`;
        const fileExtension = path_1.default.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${fileExtension}`);
    }
});
// Configure validation limits
const upload = (0, multer_1.default)({
    storage: diskStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Max file size: 5MB
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('INVALID_FILE_TYPE'));
        }
    }
});
/**
 * Single File Upload Endpoint
 * URL: POST /api/v1/uploads?type=passports
 */
router.post('/', auth_middleware_1.requireAuth, (req, res, next) => {
    // Use multer middleware to handle file streaming to disk
    upload.single('file')(req, res, (err) => {
        if (err) {
            if (err.message === 'INVALID_FILE_TYPE') {
                return (0, response_1.sendError)(res, 'Unsupported format. Only JPG, PNG, and PDF files are allowed.', 'BAD_REQUEST', null, 400);
            }
            if (err.code === 'LIMIT_FILE_SIZE') {
                return (0, response_1.sendError)(res, 'File size exceeds the 5MB threshold limit.', 'BAD_REQUEST', null, 400);
            }
            return next(err);
        }
        // Type assertion since multer adds the file property
        const multerReq = req;
        if (!multerReq.file) {
            return (0, response_1.sendError)(res, 'No file asset found in payload.', 'BAD_REQUEST', null, 400);
        }
        // Build the fully qualified public URL structure
        // e.g., http://localhost:5000/public/uploads/passports/file-17167362-abcd.png
        const serverUrl = `${req.protocol}://${req.get('host')}`;
        // Normalize path separators to forward slashes for URLs regardless of operating system
        const normalizedRelativePath = multerReq.file.path.replace(/\\/g, '/');
        const publicUrl = `${serverUrl}/${normalizedRelativePath}`;
        return (0, response_1.sendSuccess)(res, {
            url: publicUrl,
            filename: multerReq.file.filename,
            size: multerReq.file.size
        }, 'Asset saved and indexed successfully onto local instance storage.');
    });
});
exports.default = router;
