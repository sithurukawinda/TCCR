import { getFirestore }                from 'firebase-admin/firestore';
import { Attachment, AttachmentProps } from '../../domain/entities/Attachment';
import { IAttachmentRepository }       from '../../domain/repositories/IAttachmentRepository';

type AttachDoc = Omit<AttachmentProps, 'id'>;

export class FirestoreAttachmentRepository implements IAttachmentRepository {
  private readonly col = getFirestore().collection('attachments');

  async findById(id: string): Promise<Attachment | null> {
    const snap = await this.col.doc(id).get();
    if (!snap.exists) return null;
    return new Attachment({ ...(snap.data() as AttachDoc), id: snap.id });
  }

  async create(a: Attachment): Promise<void> {
    const { id, ...doc } = { ...a } as AttachmentProps;
    await this.col.doc(id).set(doc);
  }

  async delete(id: string): Promise<void> {
    await this.col.doc(id).delete();
  }
}
