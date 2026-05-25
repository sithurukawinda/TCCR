/**
 * Integration tests for Course / Semester / Subject CRUD
 * Covers: POST/PATCH/DELETE courses, lifecycle transitions,
 *         POST/PATCH/DELETE semesters, POST/PATCH/DELETE subjects
 */
import request from 'supertest';
import { app } from '../../src/app';
import { createTestUser, clearAuth, clearCollection } from '../../../../tests/integration/helpers';

let adminToken:   string;
let studentToken: string;

// ── helpers ──────────────────────────────────────────────────────────────────

async function createCourse(title = `Course-${Date.now()}`): Promise<string> {
  const res = await request(app)
    .post('/courses')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title, description: 'Test course' });
  return res.body.id as string;
}

async function addSemester(courseId: string): Promise<string> {
  const res = await request(app)
    .post(`/courses/${courseId}/semesters`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Semester 1' });
  return res.body.id as string;
}

async function addSubject(semesterId: string): Promise<string> {
  const res = await request(app)
    .post(`/semesters/${semesterId}/subjects`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Subject 1', description: '' });
  return res.body.id as string;
}

async function publishCourse(courseId: string): Promise<void> {
  const semId = await addSemester(courseId);
  await addSubject(semId);
  await request(app)
    .post(`/courses/${courseId}/publish`)
    .set('Authorization', `Bearer ${adminToken}`);
}

// ── lifecycle ─────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await clearAuth();
  const admin   = await createTestUser('admin@crud.test',   'Test@12345', 'admin',   ['admin']);
  const student = await createTestUser('student@crud.test', 'Test@12345', 'student', ['member', 'student']);
  adminToken   = admin.idToken;
  studentToken = student.idToken;
});

afterEach(async () => {
  await clearCollection('courses');
  await clearCollection('semesters');
  await clearCollection('subjects');
  await clearCollection('lessons');
  await clearCollection('batches');
  await clearCollection('outbox');
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('courses');
  await clearCollection('semesters');
  await clearCollection('subjects');
  await clearCollection('lessons');
  await clearCollection('batches');
  await clearCollection('outbox');
});

// ─── POST /courses ────────────────────────────────────────────────────────────

describe('POST /courses', () => {

  it('201 — admin creates a course in DRAFT state', async () => {
    const res = await request(app)
      .post('/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Bible Foundations', description: 'Core Bible study' })
      .expect(201);

    expect(res.body.title).toBe('Bible Foundations');
    expect(res.body.state).toBe('draft');
    expect(res.body.id).toBeDefined();
  });

  it('400 — missing title', async () => {
    await request(app)
      .post('/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'No title' })
      .expect(400);
  });

  it('409 COURSE_TITLE_EXISTS — duplicate title', async () => {
    await request(app).post('/courses').set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Dup Title' });

    const res = await request(app)
      .post('/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Dup Title' })
      .expect(409);

    expect(res.body.error.code).toBe('COURSE_TITLE_EXISTS');
  });

  it('403 — student cannot create a course', async () => {
    await request(app)
      .post('/courses')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ title: 'Unauthorized' })
      .expect(403);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app).post('/courses').send({ title: 'No Auth' }).expect(401);
  });

});

// ─── PATCH /courses/:id ───────────────────────────────────────────────────────

describe('PATCH /courses/:id', () => {

  it('200 — admin updates course title and description', async () => {
    const id  = await createCourse('Original Title');
    const res = await request(app)
      .patch(`/courses/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Updated Title', description: 'New description' })
      .expect(200);

    expect(res.body.title).toBe('Updated Title');
    expect(res.body.description).toBe('New description');
  });

  it('404 — course not found', async () => {
    await request(app)
      .patch('/courses/no-such-id')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Ghost' })
      .expect(404);
  });

  it('403 — student cannot update a course', async () => {
    const id = await createCourse();
    await request(app)
      .patch(`/courses/${id}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ title: 'Hacked' })
      .expect(403);
  });

});

// ─── POST /courses/:id/unpublish ──────────────────────────────────────────────

describe('POST /courses/:id/unpublish', () => {

  it('200 — unpublishes a PUBLISHED course back to DRAFT', async () => {
    const id = await createCourse('Unpublish Me');
    await publishCourse(id);

    const res = await request(app)
      .post(`/courses/${id}/unpublish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.state).toBe('draft');
  });

  it('409 INVALID_STATE — cannot unpublish a DRAFT course', async () => {
    const id  = await createCourse();
    const res = await request(app)
      .post(`/courses/${id}/unpublish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);

    expect(res.body.error.code).toBe('INVALID_STATE');
  });

});

// ─── POST /courses/:id/archive ────────────────────────────────────────────────

describe('POST /courses/:id/archive', () => {

  it('200 — archives a PUBLISHED course', async () => {
    const id = await createCourse('Archive Me');
    await publishCourse(id);

    const res = await request(app)
      .post(`/courses/${id}/archive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.state).toBe('archived');
  });

  it('409 INVALID_STATE — cannot archive a DRAFT course', async () => {
    const id  = await createCourse();
    const res = await request(app)
      .post(`/courses/${id}/archive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);

    expect(res.body.error.code).toBe('INVALID_STATE');
  });

});

// ─── POST /courses/:id/restore ────────────────────────────────────────────────

describe('POST /courses/:id/restore', () => {

  it('200 — restores an ARCHIVED course to DRAFT', async () => {
    const id = await createCourse('Restore Me');
    await publishCourse(id);
    await request(app).post(`/courses/${id}/archive`).set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .post(`/courses/${id}/restore`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.state).toBe('draft');
  });

  it('409 INVALID_STATE — cannot restore a DRAFT course', async () => {
    const id  = await createCourse();
    const res = await request(app)
      .post(`/courses/${id}/restore`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);

    expect(res.body.error.code).toBe('INVALID_STATE');
  });

});

// ─── DELETE /courses/:id ──────────────────────────────────────────────────────

describe('DELETE /courses/:id', () => {

  it('204 — soft-deletes a course', async () => {
    const id = await createCourse('Delete Me');
    await request(app)
      .delete(`/courses/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    // Deleted course hidden from student
    await request(app)
      .get(`/courses/${id}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(404);
  });

  it('403 — student cannot delete a course', async () => {
    const id = await createCourse();
    await request(app)
      .delete(`/courses/${id}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
  });

});

// ─── POST /courses/:id/semesters ──────────────────────────────────────────────

describe('POST /courses/:id/semesters', () => {

  it('201 — creates a semester', async () => {
    const courseId = await createCourse();
    const res = await request(app)
      .post(`/courses/${courseId}/semesters`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Semester 1' })
      .expect(201);

    expect(res.body.title).toBe('Semester 1');
    expect(res.body.courseId).toBe(courseId);
    expect(res.body.order).toBe(1);
  });

  it('400 — missing title', async () => {
    const courseId = await createCourse();
    await request(app)
      .post(`/courses/${courseId}/semesters`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(400);
  });

  it('403 — student cannot create a semester', async () => {
    const courseId = await createCourse();
    await request(app)
      .post(`/courses/${courseId}/semesters`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ title: 'Hacked Semester' })
      .expect(403);
  });

});

// ─── PATCH /semesters/:id ─────────────────────────────────────────────────────

describe('PATCH /semesters/:id', () => {

  it('200 — admin updates semester title', async () => {
    const courseId    = await createCourse();
    const semesterId  = await addSemester(courseId);

    const res = await request(app)
      .patch(`/semesters/${semesterId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Updated Semester' })
      .expect(200);

    expect(res.body.title).toBe('Updated Semester');
  });

  it('404 — semester not found', async () => {
    await request(app)
      .patch('/semesters/no-such-id')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Ghost' })
      .expect(404);
  });

});

// ─── DELETE /semesters/:id ────────────────────────────────────────────────────

describe('DELETE /semesters/:id', () => {

  it('204 — soft-deletes a semester', async () => {
    const courseId   = await createCourse();
    const semesterId = await addSemester(courseId);

    await request(app)
      .delete(`/semesters/${semesterId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
  });

  it('403 — student cannot delete a semester', async () => {
    const courseId   = await createCourse();
    const semesterId = await addSemester(courseId);

    await request(app)
      .delete(`/semesters/${semesterId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
  });

});

// ─── POST /semesters/:id/subjects ─────────────────────────────────────────────

describe('POST /semesters/:id/subjects', () => {

  it('201 — creates a subject', async () => {
    const courseId   = await createCourse();
    const semesterId = await addSemester(courseId);

    const res = await request(app)
      .post(`/semesters/${semesterId}/subjects`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Gospel of John', description: 'Deep study' })
      .expect(201);

    expect(res.body.title).toBe('Gospel of John');
    expect(res.body.semesterId).toBe(semesterId);
    expect(res.body.order).toBe(1);
  });

  it('400 — missing title', async () => {
    const courseId   = await createCourse();
    const semesterId = await addSemester(courseId);

    await request(app)
      .post(`/semesters/${semesterId}/subjects`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(400);
  });

  it('404 — semester not found', async () => {
    await request(app)
      .post('/semesters/no-such-semester/subjects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Orphan' })
      .expect(404);
  });

});

// ─── PATCH /subjects/:id ──────────────────────────────────────────────────────

describe('PATCH /subjects/:id', () => {

  it('200 — admin updates subject title', async () => {
    const courseId   = await createCourse();
    const semesterId = await addSemester(courseId);
    const subjectId  = await addSubject(semesterId);

    const res = await request(app)
      .patch(`/subjects/${subjectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Updated Subject' })
      .expect(200);

    expect(res.body.title).toBe('Updated Subject');
  });

  it('403 — student cannot update a subject', async () => {
    const courseId   = await createCourse();
    const semesterId = await addSemester(courseId);
    const subjectId  = await addSubject(semesterId);

    await request(app)
      .patch(`/subjects/${subjectId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ title: 'Hacked' })
      .expect(403);
  });

});

// ─── DELETE /subjects/:id ─────────────────────────────────────────────────────

describe('DELETE /subjects/:id', () => {

  it('204 — soft-deletes a subject', async () => {
    const courseId   = await createCourse();
    const semesterId = await addSemester(courseId);
    const subjectId  = await addSubject(semesterId);

    await request(app)
      .delete(`/subjects/${subjectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
  });

  it('403 — student cannot delete a subject', async () => {
    const courseId   = await createCourse();
    const semesterId = await addSemester(courseId);
    const subjectId  = await addSubject(semesterId);

    await request(app)
      .delete(`/subjects/${subjectId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
  });

});

// ─── GET /courses/:id/semesters ──────────────────────────────────────────────

describe('GET /courses/:id/semesters', () => {

  it('200 — returns semester list for a course', async () => {
    const courseId = await createCourse();
    await addSemester(courseId);
    await addSemester(courseId);

    const res = await request(app)
      .get(`/courses/${courseId}/semesters`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body[0].courseId).toBe(courseId);
  });

  it('200 — returns empty array for course with no semesters', async () => {
    const courseId = await createCourse();

    const res = await request(app)
      .get(`/courses/${courseId}/semesters`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('200 — student can list semesters', async () => {
    const courseId = await createCourse();
    await addSemester(courseId);

    const res = await request(app)
      .get(`/courses/${courseId}/semesters`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('401 — unauthenticated request rejected', async () => {
    const courseId = await createCourse();
    await request(app).get(`/courses/${courseId}/semesters`).expect(401);
  });

});

// ─── GET /semesters/:id/subjects ─────────────────────────────────────────────

describe('GET /semesters/:id/subjects', () => {

  it('200 — returns subject list for a semester', async () => {
    const courseId   = await createCourse();
    const semesterId = await addSemester(courseId);
    await addSubject(semesterId);
    await addSubject(semesterId);

    const res = await request(app)
      .get(`/semesters/${semesterId}/subjects`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body[0].semesterId).toBe(semesterId);
  });

  it('200 — returns empty array for semester with no subjects', async () => {
    const courseId   = await createCourse();
    const semesterId = await addSemester(courseId);

    const res = await request(app)
      .get(`/semesters/${semesterId}/subjects`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('200 — student can list subjects', async () => {
    const courseId   = await createCourse();
    const semesterId = await addSemester(courseId);
    await addSubject(semesterId);

    const res = await request(app)
      .get(`/semesters/${semesterId}/subjects`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app).get('/semesters/any-id/subjects').expect(401);
  });

});
