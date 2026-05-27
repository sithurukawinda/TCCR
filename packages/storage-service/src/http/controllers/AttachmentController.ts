import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest }             from '@shared/auth-middleware';
import { sendSuccess }                      from '@shared/response';
import { UploadAttachmentUseCase }          from '../../application/use-cases/UploadAttachmentUseCase';
import { GetDownloadUrlUseCase }            from '../../application/use-cases/GetDownloadUrlUseCase';
import { DeleteAttachmentUseCase }          from '../../application/use-cases/DeleteAttachmentUseCase';

export class AttachmentController {
  constructor(
    private readonly uploadUC:    UploadAttachmentUseCase,
    private readonly downloadUC:  GetDownloadUrlUseCase,
    private readonly deleteUC:    DeleteAttachmentUseCase,
  ) {}

  upload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // File is optional — if not provided, return early with a message.
      if (!req.file) {
        sendSuccess(res, { message: 'No file uploaded. Provide a PDF, DOC, or DOCX file to create an attachment.' });
        return;
      }
      const attachment = await this.uploadUC.execute({
        subjectId: req.params.id,
        buffer:    req.file.buffer,
        filename:  req.file.originalname,
        mimeType:  req.file.mimetype,
        sizeBytes: req.file.size,
      });
      sendSuccess(res, attachment, 201);
    } catch (err) { next(err); }
  };

  downloadUrl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid, role } = (req as AuthenticatedRequest).principal;
      const result        = await this.downloadUC.execute(req.params.id, uid, role);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  uploadImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const file  = req.file!;
      const image = await this.uploadUC.execute({
        subjectId: req.params.id,
        buffer:    file.buffer,
        filename:  file.originalname,
        mimeType:  file.mimetype,
        sizeBytes: file.size,
      });
      sendSuccess(res, image, 201);
    } catch (err) { next(err); }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.deleteUC.execute(req.params.id);
      res.status(204).send();
    } catch (err) { next(err); }
  };
}
