import { getFirestore }        from 'firebase-admin/firestore';
import { SubjectProgress, SubjectProgressProps } from '../../domain/entities/SubjectProgress';
import { IProgressRepository } from '../../domain/repositories/IProgressRepository';

type ProgressDoc = Omit<SubjectProgressProps, 'id'>;

export class FirestoreProgressRepository implements IProgressRepository {
  private readonly col = getFirestore().collection('progress');

  async findByStudentAndSubject(studentUid: string, subjectId: string): Promise<SubjectProgress | null> {
    const snap = await this.col.doc(`${studentUid}_${subjectId}`).get();
    if (!snap.exists) return null;
    return new SubjectProgress({ ...(snap.data() as ProgressDoc), id: snap.id });
  }

  async findByCourseAndStudent(courseId: string, studentUid: string): Promise<SubjectProgress[]> {
    const snap = await this.col
      .where('courseId',   '==', courseId)
      .where('studentUid', '==', studentUid)
      .get();
    return snap.docs.map(d => new SubjectProgress({ ...(d.data() as ProgressDoc), id: d.id }));
  }

  async findByCourse(courseId: string): Promise<SubjectProgress[]> {
    const snap = await this.col.where('courseId', '==', courseId).get();
    return snap.docs.map(d => new SubjectProgress({ ...(d.data() as ProgressDoc), id: d.id }));
  }

  async upsert(progress: SubjectProgress): Promise<void> {
    const { id, ...doc } = { ...progress } as SubjectProgressProps;

    // Never overwrite completedAt if already set
    const existing = await this.col.doc(id).get();
    if (existing.exists) {
      const existingData = existing.data() as ProgressDoc;
      if (existingData.completedAt !== null) {
        (doc as ProgressDoc).completedAt = existingData.completedAt;
      }
    }

    await this.col.doc(id).set(doc);
  }

  async deleteByStudentAndCourse(studentUid: string, courseId: string): Promise<void> {
    const snap = await this.col
      .where('studentUid', '==', studentUid)
      .where('courseId',   '==', courseId)
      .get();
    const db    = getFirestore();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  async revertCompletion(studentUid: string, subjectId: string): Promise<void> {
    const docId = `${studentUid}_${subjectId}`;
    await this.col.doc(docId).update({
      state:       'in_progress',
      completedAt: null,
    });
  }
}
