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

/**
 * File (`file` field, PDF/DOC/DOCX, max 25 MB) is **optional** —
 * if omitted the controller returns { message: 'No file uploaded.' } without creating an attachment.
 */
export function handleAttachmentUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return next(createHttpError(413, 'FILE_TOO_LARGE', `File exceeds ${config.maxFileSizeBytes / 1024 / 1024} MB limit.`));
    }
    if (err) return next(err);
    // No file is allowed — controller handles req.file === undefined
    if (req.file && !ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
      return next(createHttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Only PDF, DOC, and DOCX files are allowed.'));
    }
    next();
  });
}
