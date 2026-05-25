import multer                              from 'multer';
import { Request, Response, NextFunction } from 'express';
import { createHttpError }                 from '@shared/errors';

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg'];
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_IMAGE_SIZE_BYTES },
});

export function handleImageUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return next(createHttpError(413, 'FILE_TOO_LARGE', 'Image must be under 10 MB.'));
    }
    if (err) return next(err);
    if (!req.file) return next(createHttpError(400, 'VALIDATION_ERROR', 'No file provided.'));
    if (!ALLOWED_IMAGE_TYPES.includes(req.file.mimetype)) {
      return next(createHttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Only PNG and JPEG images are allowed.'));
    }
    next();
  });
}
