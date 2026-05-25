import { getFirestore }                                                          from 'firebase-admin/firestore';
import { Course, CourseProps, CourseState }                                       from '../../domain/entities/Course';
import { ICourseRepository, CourseFindAllOptions, CourseFindPublishedOptions, CourseListResult } from '../../domain/repositories/ICourseRepository';

interface CourseDoc {
  title:          string;
  description?:   string;
  coverImageUrl?: string | null;
  state:          CourseState;
  createdBy:      string;
  semesterCount:  number;
  publishedAt:    string | null;
  deletedAt:      string | null;
  createdAt:      string;
  updatedAt:      string;
}

function toEntity(id: string, data: CourseDoc): Course {
  return new Course({
    id,
    title:         data.title,
    description:   data.description   ?? '',
    coverImageUrl: data.coverImageUrl ?? null,
    state:         data.state,
    createdBy:     data.createdBy,
    semesterCount: data.semesterCount,
    publishedAt:   data.publishedAt   ?? null,
    deletedAt:     data.deletedAt     ?? null,
    createdAt:     data.createdAt,
    updatedAt:     data.updatedAt,
  });
}

export class FirestoreCourseRepository implements ICourseRepository {
  private readonly col = getFirestore().collection('courses');

  async findById(id: string): Promise<Course | null> {
    const snap = await this.col.doc(id).get();
    if (!snap.exists) return null;
    return toEntity(snap.id, snap.data() as CourseDoc);
  }

  async findByTitle(title: string): Promise<Course | null> {
    // Check ALL courses including soft-deleted — title can never be reused
    const snap = await this.col
      .where('title', '==', title)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return toEntity(doc.id, doc.data() as CourseDoc);
  }

  async findPublished(opts: CourseFindPublishedOptions): Promise<CourseListResult> {
    let q: FirebaseFirestore.Query = this.col
      .where('state',     '==', 'published')
      .where('deletedAt', '==', null);

    if (opts.title) {
      q = q.where('title', '>=', opts.title).where('title', '<=', opts.title + '');
      const total = (await q.count().get()).data().count;
      let paged   = q.orderBy('title').limit(opts.limit);
      if (opts.cursor) {
        const cs = await this.col.doc(opts.cursor).get();
        if (cs.exists) paged = paged.startAfter(cs);
      }
      const snap  = await paged.get();
      const items = snap.docs.map(d => toEntity(d.id, d.data() as CourseDoc));
      const last  = snap.docs[snap.docs.length - 1];
      return { items, nextCursor: snap.docs.length === opts.limit && last ? last.id : null, total };
    }

    const total = (await q.count().get()).data().count;
    let paged   = q.orderBy('publishedAt', 'desc').limit(opts.limit);
    if (opts.cursor) {
      const cs = await this.col.doc(opts.cursor).get();
      if (cs.exists) paged = paged.startAfter(cs);
    }
    const snap  = await paged.get();
    const items = snap.docs.map(d => toEntity(d.id, d.data() as CourseDoc));
    const last  = snap.docs[snap.docs.length - 1];
    return { items, nextCursor: snap.docs.length === opts.limit && last ? last.id : null, total };
  }

  async findAll(opts: CourseFindAllOptions): Promise<CourseListResult> {
    let q: FirebaseFirestore.Query = this.col.where('deletedAt', '==', null);
    if (opts.state) q = q.where('state', '==', opts.state);

    if (opts.title) {
      q = q.where('title', '>=', opts.title).where('title', '<=', opts.title + '');
      const total = (await q.count().get()).data().count;
      let paged   = q.orderBy('title').limit(opts.limit);
      if (opts.cursor) {
        const cs = await this.col.doc(opts.cursor).get();
        if (cs.exists) paged = paged.startAfter(cs);
      }
      const snap  = await paged.get();
      const items = snap.docs.map(d => toEntity(d.id, d.data() as CourseDoc));
      const last  = snap.docs[snap.docs.length - 1];
      return { items, nextCursor: snap.docs.length === opts.limit && last ? last.id : null, total };
    }

    const total = (await q.count().get()).data().count;
    let paged   = q.orderBy('createdAt', 'desc').limit(opts.limit);
    if (opts.cursor) {
      const cs = await this.col.doc(opts.cursor).get();
      if (cs.exists) paged = paged.startAfter(cs);
    }
    const snap  = await paged.get();
    const items = snap.docs.map(d => toEntity(d.id, d.data() as CourseDoc));
    const last  = snap.docs[snap.docs.length - 1];
    return { items, nextCursor: snap.docs.length === opts.limit && last ? last.id : null, total };
  }

  async create(course: Course): Promise<void> {
    const { id, ...doc } = { ...course } as CourseProps;
    await this.col.doc(id).set(doc);
  }

  async update(course: Course): Promise<void> {
    const { id, ...doc } = { ...course } as CourseProps;
    await this.col.doc(id).update(doc as Record<string, unknown>);
  }

  async softDelete(id: string): Promise<void> {
    await this.col.doc(id).update({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
}
