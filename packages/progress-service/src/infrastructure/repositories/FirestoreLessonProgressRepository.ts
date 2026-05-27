import { getFirestore }                                    from 'firebase-admin/firestore';
import { LessonProgress, LessonProgressProps }            from '../../domain/entities/LessonProgress';
import { ILessonProgressRepository }                      from '../../domain/repositories/ILessonProgressRepository';

type LessonProgressDoc = Omit<LessonProgressProps, 'id'>;

export class FirestoreLessonProgressRepository implements ILessonProgressRepository {
  private readonly col = getFirestore().collection('lesson_progress');

  private toEntity(id: string, data: LessonProgressDoc): LessonProgress {
    return new LessonProgress({ id, ...data });
  }

  async findByStudentAndLesson(studentUid: string, lessonId: string): Promise<LessonProgress | null> {
    const snap = await this.col.doc(`${studentUid}_${lessonId}`).get();
    if (!snap.exists) return null;
    return this.toEntity(snap.id, snap.data() as LessonProgressDoc);
  }

  async findByCourseAndStudent(courseId: string, studentUid: string): Promise<LessonProgress[]> {
    const snap = await this.col
      .where('courseId',   '==', courseId)
      .where('studentUid', '==', studentUid)
      .get();
    return snap.docs.map(d => this.toEntity(d.id, d.data() as LessonProgressDoc));
  }

  async findBySubjectAndStudent(subjectId: string, studentUid: string): Promise<LessonProgress[]> {
    const snap = await this.col
      .where('subjectId',  '==', subjectId)
      .where('studentUid', '==', studentUid)
      .get();
    return snap.docs.map(d => this.toEntity(d.id, d.data() as LessonProgressDoc));
  }

  async save(progress: LessonProgress): Promise<void> {
    const { id, ...doc } = { ...progress } as LessonProgressProps;
    await this.col.doc(id).set(doc);
  }

  async delete(studentUid: string, lessonId: string): Promise<void> {
    await this.col.doc(`${studentUid}_${lessonId}`).delete();
  }
}
