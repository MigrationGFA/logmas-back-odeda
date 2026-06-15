
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { requireAuth } from '../../middleware/auth.middleware';
import { sendSuccess, sendError } from '../../utils/response';
import { UPLOAD_FOLDER_MAP, ensureDirectoryExists } from '../../utils/fileStorage';

// Extend Express Request type to include file from multer
interface MulterRequest extends Request {
  file?: multer.File;
}

const router = Router();

// Configure custom Multer storage engine
const diskStorage = multer.diskStorage({
  destination: (req: Request, file: multer.File, cb: (error: Error | null, destination: string) => void) => {
    const uploadType = (req.query.type as string) || 'documents';
    const targetFolder = UPLOAD_FOLDER_MAP[uploadType] || UPLOAD_FOLDER_MAP.documents;
    ensureDirectoryExists(targetFolder);
    cb(null, targetFolder);
  },
  filename: (req: Request, file: multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const fileExtension = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${fileExtension}`);
  }
});

// Configure validation limits
const upload = multer({
  storage: diskStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req: Request, file: multer.File, cb: multer.FileFilterCallback) => {
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

    const multerReq = req as MulterRequest;
    
    if (!multerReq.file) {
      return sendError(res, 'No file asset found in payload.', 'BAD_REQUEST', null, 400);
    }

    const serverUrl = `${req.protocol}://${req.get('host')}`;
    const normalizedRelativePath = multerReq.file.path.replace(/\\/g, '/');
    const publicUrl = `${serverUrl}/${normalizedRelativePath}`;
    
    return sendSuccess(
      res, 
      { 
        url: publicUrl,
        filename: multerReq.file.filename,
        size: multerReq.file.size
      }, 
      'Asset saved and indexed successfully onto local instance storage.'
    );
  });
});

export default router;