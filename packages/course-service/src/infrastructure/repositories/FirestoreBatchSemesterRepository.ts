import { getFirestore }                       from 'firebase-admin/firestore';
import { BatchSemester, BatchSemesterProps }  from '../../domain/entities/BatchSemester';
import { IBatchSemesterRepository }           from '../../domain/repositories/IBatchSemesterRepository';

type BatchSemesterDoc = Omit<BatchSemesterProps, 'id'>;

function toEntity(id: string, data: BatchSemesterDoc): BatchSemester {
  return new BatchSemester({ ...data, id });
}

export class FirestoreBatchSemesterRepository implements IBatchSemesterRepository {
  private readonly col = getFirestore().collection('batch_semesters');

  async findByBatchId(batchId: string): Promise<BatchSemester[]> {
    const snap = await this.col.where('batchId', '==', batchId).get();
    return snap.docs.map(d => toEntity(d.id, d.data() as BatchSemesterDoc));
  }

  async findBySemesterId(semesterId: string): Promise<BatchSemester[]> {
    const snap = await this.col.where('semesterId', '==', semesterId).get();
    return snap.docs.map(d => toEntity(d.id, d.data() as BatchSemesterDoc));
  }

  async upsertMany(rows: BatchSemester[]): Promise<void> {
    if (rows.length === 0) return;
    const db    = getFirestore();
    const batch = db.batch();
    for (const row of rows) {
      const { id, ...doc } = { ...row } as BatchSemesterProps;
      batch.set(this.col.doc(id), doc, { merge: true });
    }
    await batch.commit();
  }

  async deleteBySemesterId(semesterId: string): Promise<void> {
    const snap = await this.col.where('semesterId', '==', semesterId).get();
    if (snap.empty) return;
    const db    = getFirestore();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  async deleteByBatchId(batchId: string): Promise<void> {
    const snap = await this.col.where('batchId', '==', batchId).get();
    if (snap.empty) return;
    const db    = getFirestore();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}
