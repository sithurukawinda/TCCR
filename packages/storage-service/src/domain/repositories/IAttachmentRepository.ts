import { Attachment } from '../entities/Attachment';

export interface IAttachmentRepository {
  findById(id: string): Promise<Attachment | null>;
  create(attachment: Attachment): Promise<void>;
  delete(id: string): Promise<void>;
}
