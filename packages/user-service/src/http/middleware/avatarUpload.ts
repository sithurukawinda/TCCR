import multer                              from 'multer';
import { Request, Response, NextFunction } from 'express';
import { createHttpError }                 from '@shared/errors';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_BYTES },
});

export function handleAvatarUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single('photo')(req, res, err => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return next(createHttpError(413, 'FILE_TOO_LARGE', 'Profile photo must be under 2 MB.'));
    }
    if (err) return next(err);
    if (!req.file) return next(createHttpError(400, 'VALIDATION_ERROR', 'No photo provided.'));
    if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
      return next(createHttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Only JPEG and PNG images are allowed.'));
    }
    next();
  });
}
