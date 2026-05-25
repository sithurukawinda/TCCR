import { getFirestore }           from 'firebase-admin/firestore';
import { Batch, BatchProps }      from '../../domain/entities/Batch';
import { IBatchRepository }       from '../../domain/repositories/IBatchRepository';

type BatchDoc = Omit<BatchProps, 'id'>;

function toEntity(id: string, data: BatchDoc): Batch {
  return new Batch({ ...data, id });
}

export class FirestoreBatchRepository implements IBatchRepository {
  private readonly col = getFirestore().collection('batches');

  async findById(id: string): Promise<Batch | null> {
    const snap = await this.col.doc(id).get();
    if (!snap.exists) return null;
    return toEntity(snap.id, snap.data() as BatchDoc);
  }

  async findByCourseId(courseId: string): Promise<Batch[]> {
    const snap = await this.col
      .where('courseId', '==', courseId)
      .orderBy('createdAt', 'asc')
      .get();
    return snap.docs.map(d => toEntity(d.id, d.data() as BatchDoc));
  }

  async create(batch: Batch): Promise<void> {
    const { id, ...doc } = { ...batch } as BatchProps;
    await this.col.doc(id).set(doc);
  }

  async update(batch: Batch): Promise<void> {
    const { id, ...doc } = { ...batch } as BatchProps;
    await this.col.doc(id).update(doc as Record<string, unknown>);
  }
}
