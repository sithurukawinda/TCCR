import { Course } from '../../../src/domain/entities/Course';

const makeCourse = (state: 'draft' | 'published' | 'archived'): Course =>
  new Course({
    id: 'c1', title: 'TypeScript Basics', description: 'Intro course',
    coverImageUrl: null, state, createdBy: 'admin-1', semesterCount: 2,
    publishedAt: state !== 'draft' ? '2026-04-01T00:00:00.000Z' : null,
    deletedAt: null,
    createdAt: '2026-04-01T00:00:00.000Z', updatedAt: '2026-04-01T00:00:00.000Z',
  });

describe('Course entity — restore()', () => {
  it('transitions state from archived to draft', () => {
    const course = makeCourse('archived');
    course.restore();
    expect(course.state).toBe('draft');
  });

  it('updates updatedAt timestamp', () => {
    const course = makeCourse('archived');
    const before = course.updatedAt;
    course.restore();
    expect(course.updatedAt).not.toBe(before);
  });

  it('does not reset publishedAt (retains history)', () => {
    const course = makeCourse('archived');
    const published = course.publishedAt;
    course.restore();
    expect(course.publishedAt).toBe(published);
  });

  it('throws 409 INVALID_STATE when called on a DRAFT course', () => {
    const course = makeCourse('draft');
    try { course.restore(); throw new Error('should not reach'); } catch (e: unknown) {
      expect((e as { status: number }).status).toBe(409);
      expect((e as { errorCode: string }).errorCode).toBe('INVALID_STATE');
    }
  });

  it('throws 409 INVALID_STATE when called on a PUBLISHED course', () => {
    const course = makeCourse('published');
    try { course.restore(); throw new Error('should not reach'); } catch (e: unknown) {
      expect((e as { status: number }).status).toBe(409);
      expect((e as { errorCode: string }).errorCode).toBe('INVALID_STATE');
    }
  });
});

describe('Course entity — full state machine', () => {
  it('DRAFT → publish() → PUBLISHED', () => {
    const c = makeCourse('draft');
    c.semesterCount = 1;
    c.publish();
    expect(c.state).toBe('published');
    expect(c.publishedAt).not.toBeNull();
  });

  it('PUBLISHED → unpublish() → DRAFT', () => {
    const c = makeCourse('published');
    c.unpublish();
    expect(c.state).toBe('draft');
    expect(c.publishedAt).toBeNull();
  });

  it('PUBLISHED → archive() → ARCHIVED', () => {
    const c = makeCourse('published');
    c.archive();
    expect(c.state).toBe('archived');
  });

  it('ARCHIVED → restore() → DRAFT', () => {
    const c = makeCourse('archived');
    c.restore();
    expect(c.state).toBe('draft');
  });

  it('full round-trip: draft → published → archived → draft', () => {
    const c = makeCourse('draft');
    c.semesterCount = 1;
    c.publish();
    c.archive();
    c.restore();
    expect(c.state).toBe('draft');
  });
});
