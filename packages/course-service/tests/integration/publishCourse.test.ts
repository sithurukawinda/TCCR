import request     from 'supertest';
import { app }     from '../../src/app';
import { createTestUser, clearAuth, clearCollection } from '../../../../tests/integration/helpers';

let adminToken:   string;
let studentToken: string;

beforeAll(async () => {
  await clearAuth();
  const admin   = await createTestUser('admin@course.test', 'Test@12345', 'admin');
  const student = await createTestUser('student@course.test', 'Test@12345', 'student');
  adminToken   = admin.idToken;
  studentToken = student.idToken;
});

afterEach(async () => {
  await clearCollection('courses');
  await clearCollection('semesters');
  await clearCollection('subjects');
  await clearCollection('outbox');
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('courses');
  await clearCollection('semesters');
  await clearCollection('subjects');
  await clearCollection('outbox');
});

async function createCourse(): Promise<string> {
  const res = await request(app)
    .post('/courses')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Test Course', description: 'A test course.', coverImageUrl: null });
  return res.body.id as string;
}

async function addSemester(courseId: string): Promise<string> {
  const res = await request(app)
    .post(`/courses/${courseId}/semesters`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Semester 1', description: '' });
  return res.body.id as string;
}

async function addSubject(semesterId: string): Promise<string> {
  const res = await request(app)
    .post(`/semesters/${semesterId}/subjects`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Subject 1', description: '', youtubeVideoId: null, attachmentIds: [] });
  return res.body.id as string;
}

describe('POST /courses/:id/publish', () => {

  it('200 — publishes course with at least one semester with one subject', async () => {
    const courseId    = await createCourse();
    const semesterId  = await addSemester(courseId);
    await addSubject(semesterId);

    const res = await request(app)
      .post(`/courses/${courseId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.state).toBe('published');
    expect(res.body.publishedAt).not.toBeNull();
  });

  it('422 NO_SEMESTERS — cannot publish course with no semesters', async () => {
    const courseId = await createCourse();
    const res = await request(app)
      .post(`/courses/${courseId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(422);

    expect(res.body.error.code).toBe('NO_SEMESTERS');
  });

  it('422 EMPTY_SEMESTER — cannot publish when a semester has no subjects', async () => {
    const courseId   = await createCourse();
    await addSemester(courseId);

    const res = await request(app)
      .post(`/courses/${courseId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(422);

    expect(res.body.error.code).toBe('EMPTY_SEMESTER');
  });

  it('403 — student cannot publish a course', async () => {
    const courseId   = await createCourse();
    const semId      = await addSemester(courseId);
    await addSubject(semId);

    await request(app)
      .post(`/courses/${courseId}/publish`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
  });

});
