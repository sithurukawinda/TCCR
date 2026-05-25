import { getFirestore }    from 'firebase-admin/firestore';
import { Enrollment, EnrollmentProps } from '../../domain/entities/Enrollment';
import { IEnrollmentRepository, EnrollmentListOptions, EnrollmentListResult } from '../../domain/repositories/IEnrollmentRepository';

type EnrolDoc = Omit<EnrollmentProps, 'id'>;

export class FirestoreEnrollmentRepository implements IEnrollmentRepository {
  private readonly col = getFirestore().collection('enrollments');

  async findById(id: string): Promise<Enrollment | null> {
    const snap = await this.col.doc(id).get();
    if (!snap.exists) return null;
    return new Enrollment({ ...(snap.data() as EnrolDoc), id: snap.id });
  }

  async findByStudentAndCourse(studentUid: string, courseId: string): Promise<Enrollment | null> {
    return this.findById(`${studentUid}_${courseId}`);
  }

  async findByStudent(studentUid: string, opts: EnrollmentListOptions): Promise<EnrollmentListResult> {
    let q: FirebaseFirestore.Query = this.col.where('studentUid', '==', studentUid);
    if (opts.state) q = q.where('state', '==', opts.state);

    const total = (await q.count().get()).data().count;
    q = q.orderBy('createdAt', 'desc').limit(opts.limit);
    if (opts.cursor) {
      const cs = await this.col.doc(opts.cursor).get();
      if (cs.exists) q = q.startAfter(cs);
    }
    const snap  = await q.get();
    const items = snap.docs.map(d => new Enrollment({ ...(d.data() as EnrolDoc), id: d.id }));
    const last  = snap.docs[snap.docs.length - 1];
    return { items, nextCursor: snap.docs.length === opts.limit && last ? last.id : null, total };
  }

  async findAll(opts: EnrollmentListOptions): Promise<EnrollmentListResult> {
    let q = this.col as FirebaseFirestore.Query;
    if (opts.state)    q = q.where('state',    '==', opts.state);
    if (opts.courseId) q = q.where('courseId', '==', opts.courseId);

    const total = (await q.count().get()).data().count;
    q = q.orderBy('createdAt', 'asc').limit(opts.limit);
    if (opts.cursor) {
      const cs = await this.col.doc(opts.cursor).get();
      if (cs.exists) q = q.startAfter(cs);
    }
    const snap  = await q.get();
    const items = snap.docs.map(d => new Enrollment({ ...(d.data() as EnrolDoc), id: d.id }));
    const last  = snap.docs[snap.docs.length - 1];
    return { items, nextCursor: snap.docs.length === opts.limit && last ? last.id : null, total };
  }

  async create(e: Enrollment): Promise<void> {
    const { id, ...doc } = { ...e } as EnrollmentProps;
    await this.col.doc(id).set(doc);
  }

  async update(e: Enrollment): Promise<void> {
    const { id, ...doc } = { ...e } as EnrollmentProps;
    await this.col.doc(id).update(doc as Record<string, unknown>);
  }
}
