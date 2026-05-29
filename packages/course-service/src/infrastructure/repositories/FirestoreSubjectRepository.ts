import { getFirestore }       from 'firebase-admin/firestore';
import { Subject, SubjectProps } from '../../domain/entities/Subject';
import { ISubjectRepository } from '../../domain/repositories/ISubjectRepository';

type SubjectDoc = Omit<SubjectProps, 'id'>;

function toEntity(id: string, data: SubjectDoc): Subject {
  return new Subject({ ...data, id });
}

export class FirestoreSubjectRepository implements ISubjectRepository {
  private readonly col = getFirestore().collection('subjects');

  async findById(id: string): Promise<Subject | null> {
    const snap = await this.col.doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as SubjectDoc;
    if (data.deletedAt !== null) return null;
    return toEntity(snap.id, data);
  }

  async findBySemesterId(semesterId: string): Promise<Subject[]> {
    const snap = await this.col
      .where('semesterId', '==', semesterId)
      .where('deletedAt',  '==', null)
      .orderBy('order', 'asc')
      .get();
    return snap.docs.map(d => toEntity(d.id, d.data() as SubjectDoc));
  }

  async findByCourseId(courseId: string): Promise<Subject[]> {
    const snap = await this.col
      .where('courseId',  '==', courseId)
      .where('deletedAt', '==', null)
      .get();
    return snap.docs.map(d => toEntity(d.id, d.data() as SubjectDoc));
  }

  async create(subject: Subject): Promise<void> {
    const { id, ...doc } = { ...subject } as SubjectProps;
    await this.col.doc(id).set(doc);
  }

  async update(subject: Subject): Promise<void> {
    const { id, ...doc } = { ...subject } as SubjectProps;
    await this.col.doc(id).update(doc as Record<string, unknown>);
  }

  async softDelete(id: string): Promise<void> {
    await this.col.doc(id).update({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }

  async hardDelete(id: string): Promise<void> {
    await this.col.doc(id).delete();
  }

  async deleteBySemesterId(semesterId: string): Promise<void> {
    let snap = await this.col.where('semesterId', '==', semesterId).limit(100).get();
    while (!snap.empty) {
      const batch = this.col.firestore.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      if (snap.docs.length < 100) break;
      snap = await this.col.where('semesterId', '==', semesterId).limit(100).get();
    }
  }
}
