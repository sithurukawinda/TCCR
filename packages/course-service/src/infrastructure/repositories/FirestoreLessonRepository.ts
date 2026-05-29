import { v4 as uuidv4 }              from 'uuid';
import { getFirestore, FieldValue }  from 'firebase-admin/firestore';
import { ILessonRepository }         from '../../domain/repositories/ILessonRepository';
import { Lesson, LessonProps }       from '../../domain/entities/Lesson';

type LessonDoc = Omit<LessonProps, 'id'>;

export class FirestoreLessonRepository implements ILessonRepository {
  private readonly col = getFirestore().collection('lessons');

  private toEntity(id: string, data: LessonDoc): Lesson {
    return new Lesson({ id, ...data });
  }

  async findById(id: string): Promise<Lesson | null> {
    const snap = await this.col.doc(id).get();
    if (!snap.exists) return null;
    return this.toEntity(snap.id, snap.data() as LessonDoc);
  }

  async findBySubject(subjectId: string): Promise<Lesson[]> {
    const snap = await this.col
      .where('subjectId', '==', subjectId)
      .where('deletedAt', '==', null)
      .orderBy('order', 'asc')
      .get();
    return snap.docs.map(d => this.toEntity(d.id, d.data() as LessonDoc));
  }

  async create(lesson: Lesson): Promise<void> {
    const id = lesson.id || uuidv4();
    await this.col.doc(id).set({
      subjectId:      lesson.subjectId,
      courseId:       lesson.courseId,
      semesterId:     lesson.semesterId,
      title:          lesson.title,
      description:    lesson.description,
      youtubeVideoId: lesson.youtubeVideoId,
      attachmentIds:  lesson.attachmentIds,
      order:          lesson.order,
      deletedAt:      null,
      createdAt:      FieldValue.serverTimestamp(),
      updatedAt:      FieldValue.serverTimestamp(),
    });
  }

  async update(lesson: Lesson): Promise<void> {
    await this.col.doc(lesson.id).update({
      title:          lesson.title,
      description:    lesson.description,
      youtubeVideoId: lesson.youtubeVideoId,
      attachmentIds:  lesson.attachmentIds,
      updatedAt:      FieldValue.serverTimestamp(),
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.col.doc(id).update({
      deletedAt: new Date().toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async hardDelete(id: string): Promise<void> {
    await this.col.doc(id).delete();
  }

  async deleteBySubjectId(subjectId: string): Promise<void> {
    let snap = await this.col.where('subjectId', '==', subjectId).limit(100).get();
    while (!snap.empty) {
      const batch = this.col.firestore.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      if (snap.docs.length < 100) break;
      snap = await this.col.where('subjectId', '==', subjectId).limit(100).get();
    }
  }

  async nextOrder(subjectId: string): Promise<number> {
    const snap = await this.col
      .where('subjectId', '==', subjectId)
      .where('deletedAt', '==', null)
      .count()
      .get();
    return snap.data().count + 1;
  }

  async countBySubject(subjectId: string): Promise<number> {
    const snap = await this.col
      .where('subjectId', '==', subjectId)
      .where('deletedAt', '==', null)
      .count()
      .get();
    return snap.data().count;
  }

  async countByCourse(courseId: string): Promise<number> {
    const snap = await this.col
      .where('courseId',  '==', courseId)
      .where('deletedAt', '==', null)
      .count()
      .get();
    return snap.data().count;
  }
}
