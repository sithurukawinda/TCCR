import { FirestoreAttachmentRepository } from './infrastructure/repositories/FirestoreAttachmentRepository';
import { CloudStorageRepository }        from './infrastructure/repositories/CloudStorageRepository';
import { CourseServiceClient }           from './infrastructure/clients/CourseServiceClient';
import { EnrollmentServiceClient }       from './infrastructure/clients/EnrollmentServiceClient';
import { UploadAttachmentUseCase }       from './application/use-cases/UploadAttachmentUseCase';
import { GetDownloadUrlUseCase }         from './application/use-cases/GetDownloadUrlUseCase';
import { DeleteAttachmentUseCase }       from './application/use-cases/DeleteAttachmentUseCase';
import { AttachmentController }          from './http/controllers/AttachmentController';

const attachRepo    = new FirestoreAttachmentRepository();
const storageRepo   = new CloudStorageRepository();
const courseClient  = new CourseServiceClient();
const enrollClient  = new EnrollmentServiceClient();

const uploadUC   = new UploadAttachmentUseCase(attachRepo, storageRepo, courseClient);
const downloadUC = new GetDownloadUrlUseCase(attachRepo, storageRepo, enrollClient);
const deleteUC   = new DeleteAttachmentUseCase(attachRepo, storageRepo);

export const container = {
  attachmentController: new AttachmentController(uploadUC, downloadUC, deleteUC),
};
