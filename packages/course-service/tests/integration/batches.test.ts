import request from 'supertest';
import { app } from '../../src/app';
import { createTestUser, clearAuth, clearCollection } from '../../../../tests/integration/helpers';

let adminToken:  string;
let memberToken: string;
let courseId:    string;

// Helper: today ± N days in YYYY-MM-DD format
const dateOffset = (days: number): string => {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().split('T')[0];
};

beforeAll(async () => {
  await clearAuth();
  await clearCollection('courses');
  await clearCollection('semesters');
  await clearCollection('subjects');

  const admin  = await createTestUser('admin@batch.test',  'Test@12345', 'admin',  ['admin']);
  const member = await createTestUser('member@batch.test', 'Test@12345', 'member', ['member']);
  adminToken  = admin.idToken;
  memberToken = member.idToken;

  // Create a published course to attach batches to
  const courseRes = await request(app)
    .post('/courses')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Batch Test Course', description: 'For batch integration tests' });
  courseId = courseRes.body.id as string;

  const semRes = await request(app)
    .post(`/courses/${courseId}/semesters`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Semester 1' });
  await request(app)
    .post(`/semesters/${semRes.body.id}/subjects`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Subject 1', description: '', youtubeVideoId: null, attachmentIds: [] });
});

afterEach(async () => {
  await clearCollection('batches');
  await clearCollection('outbox');
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('courses');
  await clearCollection('semesters');
  await clearCollection('subjects');
  await clearCollection('batches');
  await clearCollection('outbox');
});

// ─── POST /courses/:id/batches ────────────────────────────────────────────────

describe('POST /courses/:id/batches', () => {

  it('201 — admin creates a DRAFT batch', async () => {
    const res = await request(app)
      .post(`/courses/${courseId}/batches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name:        '2026 Intake 01',
        intakeStart: dateOffset(1),
        intakeEnd:   dateOffset(30),
        scheduledOpenAt: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .expect(201);

    expect(res.body.name).toBe('2026 Intake 01');
    expect(res.body.state).toBe('draft');
    expect(res.body.courseId).toBe(courseId);
    expect(res.body.id).toBeDefined();
  });

  it('201 — batch auto-opens when scheduledOpenAt is in the past', async () => {
    const res = await request(app)
      .post(`/courses/${courseId}/batches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name:        'Past Intake',
        intakeStart: dateOffset(-5),
        intakeEnd:   dateOffset(25),
        scheduledOpenAt: new Date(Date.now() - 86_400_000).toISOString(),
      })
      .expect(201);

    expect(res.body.state).toBe('open');
  });

  it('201 — batch stays DRAFT when no scheduledOpenAt', async () => {
    const res = await request(app)
      .post(`/courses/${courseId}/batches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name:        'No Schedule Intake',
        intakeStart: dateOffset(1),
        intakeEnd:   dateOffset(30),
      })
      .expect(201);

    expect(res.body.state).toBe('draft');
  });

  it('400 — missing required intakeStart and intakeEnd fields', async () => {
    await request(app)
      .post(`/courses/${courseId}/batches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Incomplete Batch' })
      .expect(400);
  });

  it('403 — member cannot create a batch', async () => {
    await request(app)
      .post(`/courses/${courseId}/batches`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Unauthorized', intakeStart: dateOffset(1), intakeEnd: dateOffset(30) })
      .expect(403);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app)
      .post(`/courses/${courseId}/batches`)
      .send({ name: 'No Auth', intakeStart: dateOffset(1), intakeEnd: dateOffset(30) })
      .expect(401);
  });

});

// ─── GET /courses/:id/batches ─────────────────────────────────────────────────
// Note: uses tryAuthenticate() — public endpoint (no auth required)

describe('GET /courses/:id/batches', () => {

  it('200 — returns array of batches', async () => {
    await request(app)
      .post(`/courses/${courseId}/batches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'List Test', intakeStart: dateOffset(1), intakeEnd: dateOffset(30) });

    const res = await request(app)
      .get(`/courses/${courseId}/batches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('name');
    expect(res.body[0]).toHaveProperty('state');
  });

  it('200 — returns empty array when no batches exist', async () => {
    const res = await request(app)
      .get(`/courses/${courseId}/batches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('200 — member can list batches', async () => {
    await request(app)
      .post(`/courses/${courseId}/batches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Member View', intakeStart: dateOffset(1), intakeEnd: dateOffset(30) });

    const res = await request(app)
      .get(`/courses/${courseId}/batches`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('200 — public access (no auth) — uses tryAuthenticate like courses', async () => {
    const res = await request(app)
      .get(`/courses/${courseId}/batches`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

});

// ─── GET /batches/:id ─────────────────────────────────────────────────────────
// Note: also uses tryAuthenticate() — public

describe('GET /batches/:id', () => {

  it('200 — returns single batch by ID', async () => {
    const createRes = await request(app)
      .post(`/courses/${courseId}/batches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Get By ID', intakeStart: dateOffset(1), intakeEnd: dateOffset(30) });

    const batchId = createRes.body.id as string;

    const res = await request(app)
      .get(`/batches/${batchId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.id).toBe(batchId);
    expect(res.body.name).toBe('Get By ID');
    expect(res.body.courseId).toBe(courseId);
  });

  it('404 BATCH_NOT_FOUND — non-existent ID', async () => {
    await request(app)
      .get('/batches/no-such-batch')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

});

// ─── PATCH /batches/:id ───────────────────────────────────────────────────────

describe('PATCH /batches/:id', () => {

  it('200 — admin updates batch name', async () => {
    const createRes = await request(app)
      .post(`/courses/${courseId}/batches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Original', intakeStart: dateOffset(1), intakeEnd: dateOffset(30) });

    const res = await request(app)
      .patch(`/batches/${createRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Name' })
      .expect(200);

    expect(res.body.name).toBe('Updated Name');
  });

  it('403 — member cannot update batch', async () => {
    const createRes = await request(app)
      .post(`/courses/${courseId}/batches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Protected', intakeStart: dateOffset(1), intakeEnd: dateOffset(30) });

    await request(app)
      .patch(`/batches/${createRes.body.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ name: 'Hacked' })
      .expect(403);
  });

});

// ─── POST /batches/:id/open ───────────────────────────────────────────────────

describe('POST /batches/:id/open', () => {

  it('200 — opens a DRAFT batch', async () => {
    const createRes = await request(app)
      .post(`/courses/${courseId}/batches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Open Test', intakeStart: dateOffset(1), intakeEnd: dateOffset(30) });

    expect(createRes.body.state).toBe('draft');

    const res = await request(app)
      .post(`/batches/${createRes.body.id}/open`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.state).toBe('open');
  });

  it('409 INVALID_STATE — cannot open an already-open batch', async () => {
    const createRes = await request(app)
      .post(`/courses/${courseId}/batches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Already Open', intakeStart: dateOffset(1), intakeEnd: dateOffset(30) });

    await request(app)
      .post(`/batches/${createRes.body.id}/open`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .post(`/batches/${createRes.body.id}/open`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);

    expect(res.body.error.code).toBe('INVALID_STATE');
  });

});

// ─── POST /batches/:id/close ──────────────────────────────────────────────────

describe('POST /batches/:id/close', () => {

  it('200 — closes an OPEN batch', async () => {
    const createRes = await request(app)
      .post(`/courses/${courseId}/batches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Close Test', intakeStart: dateOffset(-2), intakeEnd: dateOffset(30) });

    await request(app)
      .post(`/batches/${createRes.body.id}/open`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .post(`/batches/${createRes.body.id}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.state).toBe('closed');
  });

  it('409 INVALID_STATE — cannot close a DRAFT batch', async () => {
    const createRes = await request(app)
      .post(`/courses/${courseId}/batches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Draft Close', intakeStart: dateOffset(1), intakeEnd: dateOffset(30) });

    const res = await request(app)
      .post(`/batches/${createRes.body.id}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);

    expect(res.body.error.code).toBe('INVALID_STATE');
  });

});
