import request     from 'supertest';
import { app }     from '../../src/app';
import { createTestUser, clearAuth, clearCollection } from '../../../../tests/integration/helpers';

let adminToken:   string;
let studentToken: string;

beforeAll(async () => {
  await clearAuth();
  await clearCollection('courses');
  await clearCollection('semesters');
  await clearCollection('subjects');

  const admin   = await createTestUser('admin@list.test',   'Test@12345', 'admin');
  const student = await createTestUser('student@list.test', 'Test@12345', 'student');
  adminToken   = admin.idToken;
  studentToken = student.idToken;

  // Create DRAFT course
  await request(app)
    .post('/courses')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Draft Course', description: 'Not published.' });

  // Create and publish a course
  const pub = await request(app)
    .post('/courses')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Published Course', description: 'Available.' });
  const courseId  = pub.body.id as string;
  const sem = await request(app)
    .post(`/courses/${courseId}/semesters`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'S1', description: '' });
  await request(app)
    .post(`/semesters/${sem.body.id}/subjects`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Sub1', description: '', youtubeVideoId: null, attachmentIds: [] });
  await request(app)
    .post(`/courses/${courseId}/publish`)
    .set('Authorization', `Bearer ${adminToken}`);
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('courses');
  await clearCollection('semesters');
  await clearCollection('subjects');
  await clearCollection('outbox');
});

describe('GET /courses', () => {

  it('student sees only PUBLISHED courses', async () => {
    const res = await request(app)
      .get('/courses')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const titles = (res.body.items as Array<{ title: string; state: string }>).map(c => c.title);
    expect(titles).toContain('Published Course');
    expect(titles).not.toContain('Draft Course');
  });

  it('admin sees all courses including DRAFT', async () => {
    const res = await request(app)
      .get('/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const titles = (res.body.items as Array<{ title: string }>).map(c => c.title);
    expect(titles).toContain('Published Course');
    expect(titles).toContain('Draft Course');
  });

  it('unauthenticated request sees only PUBLISHED courses', async () => {
    const res = await request(app).get('/courses').expect(200);
    const states = (res.body.items as Array<{ state: string }>).map(c => c.state);
    expect(states.every(s => s === 'published')).toBe(true);
  });

});

describe('GET /courses/:id', () => {

  it('404 — student cannot access DRAFT course', async () => {
    // Find the draft course ID
    const adminRes = await request(app)
      .get('/courses')
      .set('Authorization', `Bearer ${adminToken}`);
    const draft = (adminRes.body.items as Array<{ id: string; state: string }>)
      .find(c => c.state === 'draft');

    if (draft) {
      await request(app)
        .get(`/courses/${draft.id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(404);
    }
  });

});
