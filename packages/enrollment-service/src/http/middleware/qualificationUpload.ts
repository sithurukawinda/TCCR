import multer                              from 'multer';
import { Request, Response, NextFunction } from 'express';
import { createHttpError }                 from '@shared/errors';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_FILE_SIZE_BYTES },
});

/**
 * Parses multipart/form-data for POST /role-requests.
 * Field `qualificationFile` (PDF only, max 10 MB) is **optional** —
 * if omitted the request proceeds without a qualification file attached.
 * Puts all other form fields in req.body as usual.
 */
export function handleQualificationUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single('qualificationFile')(req, res, err => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return next(createHttpError(413, 'FILE_TOO_LARGE', 'Qualification file must be 10 MB or smaller.'));
    }
    if (err) return next(err);
    // No file is allowed — controller handles req.file === undefined
    if (req.file && req.file.mimetype !== 'application/pdf') {
      return next(createHttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Only PDF files are accepted for qualifications.'));
    }
    next();
  });
}
