import request from 'supertest';
import { app } from '../../src/app';
import { createTestUser, clearAuth, clearCollection } from '../../../../tests/integration/helpers';

let adminToken:   string;
let studentToken: string;
let subjectId:    string;

beforeAll(async () => {
  await clearAuth();
  await clearCollection('courses');
  await clearCollection('semesters');
  await clearCollection('subjects');
  await clearCollection('lessons');

  const admin   = await createTestUser('admin@lesson.test',   'Test@12345', 'admin',   ['admin']);
  const student = await createTestUser('student@lesson.test', 'Test@12345', 'student', ['member', 'student']);
  adminToken   = admin.idToken;
  studentToken = student.idToken;

  // Build: Course → Semester → Subject
  const courseRes = await request(app)
    .post('/courses')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Lesson Test Course', description: 'For lesson tests' });
  const courseId = courseRes.body.id as string;

  const semRes = await request(app)
    .post(`/courses/${courseId}/semesters`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Semester 1' });
  const semesterId = semRes.body.id as string;

  const subRes = await request(app)
    .post(`/semesters/${semesterId}/subjects`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Subject 1', description: '', youtubeVideoId: null, attachmentIds: [] });
  subjectId = subRes.body.id as string;
});

afterEach(async () => {
  await clearCollection('lessons');
  await clearCollection('outbox');
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('courses');
  await clearCollection('semesters');
  await clearCollection('subjects');
  await clearCollection('lessons');
  await clearCollection('outbox');
});

// ─── POST /subjects/:id/lessons ───────────────────────────────────────────────

describe('POST /subjects/:id/lessons', () => {

  it('201 — admin creates a lesson with title only', async () => {
    const res = await request(app)
      .post(`/subjects/${subjectId}/lessons`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Introduction to the Gospel', description: 'An overview.' })
      .expect(201);

    expect(res.body.title).toBe('Introduction to the Gospel');
    expect(res.body.description).toBe('An overview.');
    expect(res.body.subjectId).toBe(subjectId);
    expect(res.body.youtubeVideoId).toBeNull();
    expect(res.body.attachmentIds).toEqual([]);
    expect(res.body.order).toBe(1);
    expect(res.body.id).toBeDefined();
  });

  it('201 — lesson with YouTube URL — extracts 11-char ID', async () => {
    const res = await request(app)
      .post(`/subjects/${subjectId}/lessons`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title:          'Video Lesson',
        description:    'With YouTube.',
        youtubeVideoId: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        attachmentIds:  [],
      })
      .expect(201);

    expect(res.body.youtubeVideoId).toBe('dQw4w9WgXcQ');
  });

  it('201 — second lesson gets order 2', async () => {
    await request(app)
      .post(`/subjects/${subjectId}/lessons`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Lesson 1', description: '' });

    const res = await request(app)
      .post(`/subjects/${subjectId}/lessons`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Lesson 2', description: '' })
      .expect(201);

    expect(res.body.order).toBe(2);
  });

  it('400 — missing required title', async () => {
    await request(app)
      .post(`/subjects/${subjectId}/lessons`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'No title here' })
      .expect(400);
  });

  it('400 — invalid YouTube URL format', async () => {
    await request(app)
      .post(`/subjects/${subjectId}/lessons`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Bad Video', youtubeVideoId: 'not-a-url' })
      .expect(400);
  });

  it('403 — student cannot create lessons', async () => {
    await request(app)
      .post(`/subjects/${subjectId}/lessons`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ title: 'Unauthorized Lesson', description: '' })
      .expect(403);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app)
      .post(`/subjects/${subjectId}/lessons`)
      .send({ title: 'No Auth Lesson' })
      .expect(401);
  });

  it('404 — subject does not exist', async () => {
    await request(app)
      .post('/subjects/no-such-subject/lessons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Orphan Lesson', description: '' })
      .expect(404);
  });

});

// ─── GET /subjects/:id/lessons ────────────────────────────────────────────────

describe('GET /subjects/:id/lessons', () => {

  it('200 — returns lessons ordered by order ascending', async () => {
    await request(app)
      .post(`/subjects/${subjectId}/lessons`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Lesson A', description: '' });
    await request(app)
      .post(`/subjects/${subjectId}/lessons`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Lesson B', description: '' });

    const res = await request(app)
      .get(`/subjects/${subjectId}/lessons`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.length).toBe(2);
    expect(res.body[0].order).toBeLessThanOrEqual(res.body[1].order);
    expect(res.body[0].title).toBe('Lesson A');
  });

  it('200 — returns empty array when no lessons exist', async () => {
    const res = await request(app)
      .get(`/subjects/${subjectId}/lessons`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toEqual([]);
  });

  it('200 — student can view lessons', async () => {
    await request(app)
      .post(`/subjects/${subjectId}/lessons`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Student Visible', description: '' });

    await request(app)
      .get(`/subjects/${subjectId}/lessons`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app)
      .get(`/subjects/${subjectId}/lessons`)
      .expect(401);
  });

});

// ─── PATCH /lessons/:id ───────────────────────────────────────────────────────

describe('PATCH /lessons/:id', () => {

  it('200 — admin updates lesson title and description', async () => {
    const createRes = await request(app)
      .post(`/subjects/${subjectId}/lessons`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Original Title', description: 'Original desc' });

    const lessonId = createRes.body.id as string;

    const res = await request(app)
      .patch(`/lessons/${lessonId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Updated Title', description: 'Updated desc' })
      .expect(200);

    expect(res.body.title).toBe('Updated Title');
    expect(res.body.description).toBe('Updated desc');
  });

  it('200 — clears youtubeVideoId when null is passed', async () => {
    const createRes = await request(app)
      .post(`/subjects/${subjectId}/lessons`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Video Lesson',
        description: '',
        youtubeVideoId: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      });

    const lessonId = createRes.body.id as string;

    const res = await request(app)
      .patch(`/lessons/${lessonId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ youtubeVideoId: null })
      .expect(200);

    expect(res.body.youtubeVideoId).toBeNull();
  });

  it('404 — lesson does not exist', async () => {
    await request(app)
      .patch('/lessons/no-such-lesson')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Ghost Lesson' })
      .expect(404);
  });

  it('403 — student cannot update lessons', async () => {
    const createRes = await request(app)
      .post(`/subjects/${subjectId}/lessons`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Protected Lesson', description: '' });

    await request(app)
      .patch(`/lessons/${createRes.body.id}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ title: 'Hacked' })
      .expect(403);
  });

});

// ─── DELETE /lessons/:id ──────────────────────────────────────────────────────

describe('DELETE /lessons/:id', () => {

  it('204 — admin soft-deletes a lesson', async () => {
    const createRes = await request(app)
      .post(`/subjects/${subjectId}/lessons`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'To Be Deleted', description: '' });

    const lessonId = createRes.body.id as string;

    await request(app)
      .delete(`/lessons/${lessonId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    // Deleted lesson should not appear in list
    const listRes = await request(app)
      .get(`/subjects/${subjectId}/lessons`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const ids = listRes.body.map((l: { id: string }) => l.id);
    expect(ids).not.toContain(lessonId);
  });

  it('404 — deleting a non-existent lesson', async () => {
    await request(app)
      .delete('/lessons/no-such-lesson')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('403 — student cannot delete lessons', async () => {
    const createRes = await request(app)
      .post(`/subjects/${subjectId}/lessons`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Protected From Delete', description: '' });

    await request(app)
      .delete(`/lessons/${createRes.body.id}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
  });

});
