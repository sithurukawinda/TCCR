import multer                         from 'multer';
import { Request, Response, NextFunction } from 'express';
import { createHttpError }            from '@shared/errors';
import { config }                     from '../../config';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: config.maxFileSizeBytes },
});

export function handleAttachmentUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return next(createHttpError(413, 'FILE_TOO_LARGE', `File exceeds ${config.maxFileSizeBytes / 1024 / 1024} MB limit.`));
    }
    if (err) return next(err);
    if (!req.file) return next(createHttpError(400, 'VALIDATION_ERROR', 'No file provided.'));
    if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
      return next(createHttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Only PDF, DOC, and DOCX files are allowed.'));
    }
    next();
  });
}
