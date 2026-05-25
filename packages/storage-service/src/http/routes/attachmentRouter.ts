import { Router }                  from 'express';
import { authenticate, authorize } from '@shared/auth-middleware';
import { handleAttachmentUpload }  from '../middleware/attachmentUpload';
import { handleImageUpload }       from '../middleware/imageUpload';
import { container }               from '../../container';

export const attachmentRouter = Router();

attachmentRouter.post(  '/subjects/:id/attachments',        authenticate(), authorize('admin'), handleAttachmentUpload, container.attachmentController.upload);
attachmentRouter.post(  '/subjects/:id/images',             authenticate(), authorize('admin'), handleImageUpload,      container.attachmentController.uploadImage);
attachmentRouter.get(   '/attachments/:id/download-url',    authenticate(), authorize('student', 'admin'), container.attachmentController.downloadUrl);
attachmentRouter.delete('/attachments/:id',                 authenticate(), authorize('admin'), container.attachmentController.remove);
