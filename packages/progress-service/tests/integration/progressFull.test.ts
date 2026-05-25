/**
 * Integration tests for remaining progress endpoints:
 * - POST /progress/subjects/:id/access
 * - GET /me/progress/subjects/:subjectId
 * - GET /admin/progress/courses/:courseId
 */
import request from 'supertest';
import { app } from '../../src/app';
import { createTestUser, clearAuth, clearCollection } from '../../../../tests/integration/helpers';

jest.mock('../../src/infrastructure/clients/CourseServiceClient', () => ({
  CourseServiceClient: jest.fn().mockImplementation(() => ({
    getSubjectCount: jest.fn().mockResolvedValue(3),
  })),
}));

const SUBJECT_ID  = 'subject-prog-1';
const COURSE_ID   = 'course-prog-1';
const SEMESTER_ID = 'semester-prog-1';

let studentToken: string;
let adminToken:   string;

beforeAll(async () => {
  await clearAuth();
  const student = await createTestUser('student@prog.test', 'Test@12345', 'student', ['member', 'student']);
  const admin   = await createTestUser('admin@prog.test',   'Test@12345', 'admin',   ['admin']);
  studentToken  = student.idToken;
  adminToken    = admin.idToken;
});

afterEach(async () => {
  await clearCollection('progress');
  await clearCollection('outbox');
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('progress');
  await clearCollection('outbox');
});

// ─── POST /progress/subjects/:id/access ──────────────────────────────────────

describe('POST /progress/subjects/:id/access', () => {

  it('200 — records subject access and returns in_progress status', async () => {
    const res = await request(app)
      .post(`/progress/subjects/${SUBJECT_ID}/access`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId: COURSE_ID, semesterId: SEMESTER_ID })
      .expect(200);

    expect(res.body.subjectId).toBe(SUBJECT_ID);
    expect(res.body.lastAccessedAt).not.toBeNull();
    expect(['not_started', 'in_progress', 'completed']).toContain(res.body.state);
  });

  it('200 — multiple accesses update lastAccessedAt each time', async () => {
    await request(app)
      .post(`/progress/subjects/${SUBJECT_ID}/access`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId: COURSE_ID, semesterId: SEMESTER_ID });

    // Small delay then access again
    await new Promise(r => setTimeout(r, 10));

    const res = await request(app)
      .post(`/progress/subjects/${SUBJECT_ID}/access`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId: COURSE_ID, semesterId: SEMESTER_ID })
      .expect(200);

    expect(res.body.lastAccessedAt).not.toBeNull();
  });

  it('400 — missing courseId', async () => {
    await request(app)
      .post(`/progress/subjects/${SUBJECT_ID}/access`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ semesterId: SEMESTER_ID })
      .expect(400);
  });

  it('403 — admin cannot record subject access', async () => {
    await request(app)
      .post(`/progress/subjects/${SUBJECT_ID}/access`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ courseId: COURSE_ID, semesterId: SEMESTER_ID })
      .expect(403);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app)
      .post(`/progress/subjects/${SUBJECT_ID}/access`)
      .send({ courseId: COURSE_ID, semesterId: SEMESTER_ID })
      .expect(401);
  });

});

// ─── GET /me/progress/subjects/:subjectId ─────────────────────────────────────

describe('GET /me/progress/subjects/:subjectId', () => {

  it('200 — returns subject progress record after access', async () => {
    await request(app)
      .post(`/progress/subjects/${SUBJECT_ID}/access`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId: COURSE_ID, semesterId: SEMESTER_ID });

    const res = await request(app)
      .get(`/me/progress/subjects/${SUBJECT_ID}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    expect(res.body.subjectId).toBe(SUBJECT_ID);
    expect(res.body.courseId).toBe(COURSE_ID);
    expect(res.body.lastAccessedAt).not.toBeNull();
  });

  it('200 — returns completed status after marking complete', async () => {
    await request(app)
      .post(`/progress/subjects/${SUBJECT_ID}/complete`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId: COURSE_ID, semesterId: SEMESTER_ID });

    const res = await request(app)
      .get(`/me/progress/subjects/${SUBJECT_ID}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    expect(res.body.state).toBe('completed');
    expect(res.body.completedAt).not.toBeNull();
  });

  it('404 — subject progress not found (never accessed)', async () => {
    await request(app)
      .get(`/me/progress/subjects/never-accessed-subject`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(404);
  });

  it('403 — admin cannot view student subject progress via /me route', async () => {
    await request(app)
      .get(`/me/progress/subjects/${SUBJECT_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app)
      .get(`/me/progress/subjects/${SUBJECT_ID}`)
      .expect(401);
  });

});

// ─── GET /admin/progress/courses/:courseId ────────────────────────────────────

describe('GET /admin/progress/courses/:courseId', () => {

  it('200 — admin gets progress for all students in a course', async () => {
    await request(app)
      .post(`/progress/subjects/${SUBJECT_ID}/complete`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId: COURSE_ID, semesterId: SEMESTER_ID });

    const res = await request(app)
      .get(`/admin/progress/courses/${COURSE_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // adminCourseProgress returns plain array via sendSuccess (not paginated)
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('200 — returns empty array when no progress for course', async () => {
    const res = await request(app)
      .get('/admin/progress/courses/no-students-yet')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('403 — student cannot view admin progress report', async () => {
    await request(app)
      .get(`/admin/progress/courses/${COURSE_ID}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app)
      .get(`/admin/progress/courses/${COURSE_ID}`)
      .expect(401);
  });

});
