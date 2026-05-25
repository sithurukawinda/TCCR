import { getFirestore }            from 'firebase-admin/firestore';
import { Semester, SemesterProps } from '../../domain/entities/Semester';
import { ISemesterRepository }     from '../../domain/repositories/ISemesterRepository';

type SemesterDoc = Omit<SemesterProps, 'id'>;

function toEntity(id: string, raw: FirebaseFirestore.DocumentData): Semester {
  const data = raw as Record<string, unknown>;
  return new Semester({
    id,
    courseId:     data.courseId     as string,
    title:        data.title        as string,
    subjectCount: data.subjectCount as number,
    order:        data.order        as number,
    openDate:     (data.openDate  as string | null | undefined) ?? null,
    endDate:      (data.endDate   as string | null | undefined) ?? null,
    status:       (data.status    as 'active' | 'disabled' | undefined) ?? 'active',
    deletedAt:    (data.deletedAt as string | null | undefined) ?? null,
    createdAt:    data.createdAt  as string,
    updatedAt:    data.updatedAt  as string,
  });
}

export class FirestoreSemesterRepository implements ISemesterRepository {
  private readonly col = getFirestore().collection('semesters');

  async findById(id: string): Promise<Semester | null> {
    const snap = await this.col.doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as SemesterDoc;
    if (data.deletedAt !== null) return null;
    return toEntity(snap.id, data);
  }

  async findByCourseId(courseId: string): Promise<Semester[]> {
    const snap = await this.col
      .where('courseId',  '==', courseId)
      .where('deletedAt', '==', null)
      .orderBy('order', 'asc')
      .get();
    return snap.docs.map(d => toEntity(d.id, d.data()));
  }

  async create(semester: Semester): Promise<void> {
    const { id, ...doc } = { ...semester } as SemesterProps;
    await this.col.doc(id).set(doc);
  }

  async update(semester: Semester): Promise<void> {
    const { id, ...doc } = { ...semester } as SemesterProps;
    await this.col.doc(id).update(doc as Record<string, unknown>);
  }

  async softDelete(id: string): Promise<void> {
    await this.col.doc(id).update({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
}
