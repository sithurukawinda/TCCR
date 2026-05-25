import { createHttpError }          from '@shared/errors';
import { IAttachmentRepository }    from '../../domain/repositories/IAttachmentRepository';
import { CloudStorageRepository }   from '../../infrastructure/repositories/CloudStorageRepository';
import { EnrollmentServiceClient }  from '../../infrastructure/clients/EnrollmentServiceClient';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

export interface DownloadUrlResult {
  downloadUrl: string;
  expiresAt:   string;
}

export class GetDownloadUrlUseCase {
  constructor(
    private readonly attachRepo:      IAttachmentRepository,
    private readonly storageRepo:     CloudStorageRepository,
    private readonly enrollClient:    EnrollmentServiceClient,
  ) {}

  async execute(attachmentId: string, callerUid: string, callerRole: string): Promise<DownloadUrlResult> {
    const attachment = await this.attachRepo.findById(attachmentId);
    if (!attachment) throw createHttpError(404, 'ATTACHMENT_NOT_FOUND', 'Attachment not found.');

    if (callerRole === 'student') {
      const enrolled = await this.enrollClient.isEnrolled(callerUid, attachment.courseId);
      if (!enrolled) throw createHttpError(403, 'FORBIDDEN', 'You must be enrolled in this course to download attachments.');
    }

    const expiresAt   = new Date(Date.now() + FIFTEEN_MINUTES_MS).toISOString();
    const downloadUrl = await this.storageRepo.getSignedUrl(attachment.storagePath, FIFTEEN_MINUTES_MS);
    return { downloadUrl, expiresAt };
  }
}
