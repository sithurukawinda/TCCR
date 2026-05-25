import { createHttpError }         from '@shared/errors';
import { IAttachmentRepository }   from '../../domain/repositories/IAttachmentRepository';
import { CloudStorageRepository }  from '../../infrastructure/repositories/CloudStorageRepository';

export class DeleteAttachmentUseCase {
  constructor(
    private readonly attachRepo:  IAttachmentRepository,
    private readonly storageRepo: CloudStorageRepository,
  ) {}

  async execute(attachmentId: string): Promise<void> {
    const attachment = await this.attachRepo.findById(attachmentId);
    if (!attachment) throw createHttpError(404, 'ATTACHMENT_NOT_FOUND', 'Attachment not found.');

    await this.storageRepo.delete(attachment.storagePath);
    await this.attachRepo.delete(attachmentId);
  }
}
