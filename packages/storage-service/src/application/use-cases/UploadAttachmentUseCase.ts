import { v4 as uuidv4 }              from 'uuid';
import { createHttpError }           from '@shared/errors';
import { IAttachmentRepository }     from '../../domain/repositories/IAttachmentRepository';
import { CloudStorageRepository }    from '../../infrastructure/repositories/CloudStorageRepository';
import { CourseServiceClient }       from '../../infrastructure/clients/CourseServiceClient';
import { Attachment }                from '../../domain/entities/Attachment';

export interface UploadInput {
  subjectId: string;
  buffer:    Buffer;
  filename:  string;
  mimeType:  string;
  sizeBytes: number;
}

export class UploadAttachmentUseCase {
  constructor(
    private readonly attachRepo:   IAttachmentRepository,
    private readonly storageRepo:  CloudStorageRepository,
    private readonly courseClient: CourseServiceClient,
  ) {}

  async execute(input: UploadInput): Promise<Attachment> {
    const subject = await this.courseClient.getSubject(input.subjectId);
    if (!subject) throw createHttpError(404, 'SUBJECT_NOT_FOUND', 'Subject not found.');

    const id          = uuidv4();
    const MIME_TO_EXT: Record<string, string> = {
      'image/png':   'png',
      'image/jpeg':  'jpg',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    };
    const ext         = MIME_TO_EXT[input.mimeType] ?? input.filename.split('.').pop()?.toLowerCase() ?? 'bin';
    const storagePath = `attachments/${input.subjectId}/${id}.${ext}`;

    await this.storageRepo.upload(input.buffer, storagePath, input.mimeType);

    const attachment = new Attachment({
      id,
      subjectId:   input.subjectId,
      courseId:    subject.courseId,
      filename:    input.filename,
      mimeType:    input.mimeType,
      sizeBytes:   input.sizeBytes,
      storagePath,
      createdAt:   new Date().toISOString(),
    });

    await this.attachRepo.create(attachment);
    return attachment;
  }
}
