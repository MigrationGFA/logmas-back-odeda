import 'express';
import { File } from 'multer';

declare global {
  namespace Express {
    interface Multer {
      File: File;
    }
  }
}