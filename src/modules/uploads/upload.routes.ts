import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { requireAuth } from '../../middleware/auth.middleware';
import { sendSuccess, sendError } from '../../utils/response';
import { UPLOAD_FOLDER_MAP, ensureDirectoryExists } from '../../utils/fileStorage';

const router = Router();

// Configure custom Multer storage engine
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Read the type parameter from the request query string (e.g., ?type=passports)
    const uploadType = (req.query.type as string) || 'documents';
    const targetFolder = UPLOAD_FOLDER_MAP[uploadType] || UPLOAD_FOLDER_MAP.documents;

    // Auto-create folder structural paths on cPanel dynamically if missing
    ensureDirectoryExists(targetFolder);
    
    cb(null, targetFolder);
  },
  filename: (req, file, cb) => {
    // Generate a secure unique name: timestamp + random bytes + original extension
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const fileExtension = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${fileExtension}`);
  }
});

// Configure validation limits
const upload = multer({
  storage: diskStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max file size: 5MB
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('INVALID_FILE_TYPE'));
    }
  }
});

/**
 * Single File Upload Endpoint
 * URL: POST /api/v1/uploads?type=passports
 */
router.post('/', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  // Use multer middleware to handle file streaming to disk
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err.message === 'INVALID_FILE_TYPE') {
        return sendError(res, 'Unsupported format. Only JPG, PNG, and PDF files are allowed.', 'BAD_REQUEST', null, 400);
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return sendError(res, 'File size exceeds the 5MB threshold limit.', 'BAD_REQUEST', null, 400);
      }
      return next(err);
    }

    if (!req.file) {
      return sendError(res, 'No file asset found in payload.', 'BAD_REQUEST', null, 400);
    }

    // Build the fully qualified public URL structure
    // e.g., http://localhost:5000/public/uploads/passports/file-17167362-abcd.png
    const serverUrl = `${req.protocol}://${req.get('host')}`;
    
    // Normalize path separators to forward slashes for URLs regardless of operating system
    const normalizedRelativePath = req.file.path.replace(/\\/g, '/');
    const publicUrl = `${serverUrl}/${normalizedRelativePath}`;

    return sendSuccess(
      res, 
      { 
        url: publicUrl,
        filename: req.file.filename,
        size: req.file.size
      }, 
      'Asset saved and indexed successfully onto local instance storage.'
    );
  });
});

export default router;