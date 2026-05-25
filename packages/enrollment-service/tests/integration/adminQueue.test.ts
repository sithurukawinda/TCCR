/**
 * Integration tests for enrollment admin queue:
 * - Registration approve / reject (individual)
 * - Enrollment approve / reject / withdraw
 * - GET /admin/enrollments
 */
import request from 'supertest';
import { getFirestore } from 'firebase-admin/firestore';
import { app } from '../../src/app';
import { createTestUser, clearAuth, clearCollection, now } from '../../../../tests/integration/helpers';

jest.mock('../../src/infrastructure/clients/CourseServiceClient', () => ({
  CourseServiceClient: jest.fn().mockImplementation(() => ({
    isCoursePublished: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock('../../src/infrastructure/clients/UserServiceClient', () => ({
  UserServiceClient: jest.fn().mockImplementation(() => ({
    approveUser: jest.fn().mockResolvedValue(undefined),
    addRole:     jest.fn().mockResolvedValue(undefined),
  })),
}));

const COURSE_ID = 'course-test-001';

let adminToken:   string;
let studentToken: string;
let studentUid:   string;

beforeAll(async () => {
  await clearAuth();
  const admin   = await createTestUser('admin@queue.test',   'Test@12345', 'admin',   ['admin']);
  const student = await createTestUser('student@queue.test', 'Test@12345', 'student', ['member', 'student']);
  adminToken   = admin.idToken;
  studentToken = student.idToken;
  studentUid   = student.uid;
});

afterEach(async () => {
  await clearCollection('registrations');
  await clearCollection('enrollments');
  await clearCollection('outbox');
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('registrations');
  await clearCollection('enrollments');
  await clearCollection('outbox');
});

// ─── helpers ──────────────────────────────────────────────────────────────────

async function seedRegistration(id: string, state: string = 'pending') {
  await getFirestore().collection('registrations').doc(id).set({
    studentUid: studentUid, email: 'student@queue.test',
    firstName: 'Test', lastName: 'Student',
    state, reason: null, createdAt: now(), updatedAt: now(),
  });
}

async function createEnrollment(): Promise<string> {
  const res = await request(app)
    .post(`/courses/${COURSE_ID}/enroll`)
    .set('Authorization', `Bearer ${studentToken}`);
  return res.body.id as string;
}

// ─── POST /admin/registrations/:id/approve ───────────────────────────────────

describe('POST /admin/registrations/:id/approve', () => {

  it('200 — admin approves a pending registration', async () => {
    await seedRegistration('reg-001', 'pending');

    const res = await request(app)
      .post('/admin/registrations/reg-001/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.state).toBe('approved');
  });

  it('409 INVALID_STATE — cannot approve already-approved registration', async () => {
    await seedRegistration('reg-002', 'approved');

    const res = await request(app)
      .post('/admin/registrations/reg-002/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);

    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  it('404 — registration not found', async () => {
    await request(app)
      .post('/admin/registrations/no-such-reg/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('403 — student cannot approve registrations', async () => {
    await seedRegistration('reg-003', 'pending');
    await request(app)
      .post('/admin/registrations/reg-003/approve')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
  });

});

// ─── POST /admin/registrations/:id/reject ────────────────────────────────────

describe('POST /admin/registrations/:id/reject', () => {

  it('200 — admin rejects a pending registration with reason', async () => {
    await seedRegistration('reg-rej-001', 'pending');

    const res = await request(app)
      .post('/admin/registrations/reg-rej-001/reject')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Prerequisites not met.' })
      .expect(200);

    expect(res.body.state).toBe('rejected');
    expect(res.body.reason).toBe('Prerequisites not met.');
  });

  it('409 INVALID_STATE — cannot reject an already-rejected registration', async () => {
    await seedRegistration('reg-rej-002', 'rejected');

    const res = await request(app)
      .post('/admin/registrations/reg-rej-002/reject')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Again' })
      .expect(409);

    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  it('404 — registration not found', async () => {
    await request(app)
      .post('/admin/registrations/no-such-reg/reject')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Not found' })
      .expect(404);
  });

});

// ─── GET /admin/enrollments ───────────────────────────────────────────────────

describe('GET /admin/enrollments', () => {

  it('200 — admin lists all enrollments', async () => {
    await createEnrollment();

    const res = await request(app)
      .get('/admin/enrollments')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.items).toBeInstanceOf(Array);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it('200 — returns empty list when no enrollments', async () => {
    const res = await request(app)
      .get('/admin/enrollments')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.items).toHaveLength(0);
  });

  it('403 — student cannot list all enrollments', async () => {
    await request(app)
      .get('/admin/enrollments')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app).get('/admin/enrollments').expect(401);
  });

});

// ─── POST /admin/enrollments/:id/approve ─────────────────────────────────────

describe('POST /admin/enrollments/:id/approve', () => {

  it('200 — admin approves a pending enrollment', async () => {
    const enrollmentId = await createEnrollment();

    const res = await request(app)
      .post(`/admin/enrollments/${enrollmentId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.state).toBe('approved');
    expect(res.body.approvedAt).not.toBeNull();
  });

  it('409 INVALID_STATE — cannot approve an already-approved enrollment', async () => {
    const enrollmentId = await createEnrollment();
    await request(app)
      .post(`/admin/enrollments/${enrollmentId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .post(`/admin/enrollments/${enrollmentId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);

    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  it('404 — enrollment not found', async () => {
    await request(app)
      .post('/admin/enrollments/no-such-id/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('403 — student cannot approve enrollments', async () => {
    const enrollmentId = await createEnrollment();
    await request(app)
      .post(`/admin/enrollments/${enrollmentId}/approve`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
  });

});

// ─── POST /admin/enrollments/:id/reject ──────────────────────────────────────

describe('POST /admin/enrollments/:id/reject', () => {

  it('200 — admin rejects a pending enrollment', async () => {
    const enrollmentId = await createEnrollment();

    const res = await request(app)
      .post(`/admin/enrollments/${enrollmentId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Batch capacity reached.' })
      .expect(200);

    expect(res.body.state).toBe('rejected');
    expect(res.body.reason).toBe('Batch capacity reached.');
  });

  it('409 INVALID_STATE — cannot reject an already-rejected enrollment', async () => {
    const enrollmentId = await createEnrollment();
    await request(app)
      .post(`/admin/enrollments/${enrollmentId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'First rejection' });

    const res = await request(app)
      .post(`/admin/enrollments/${enrollmentId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Second' })
      .expect(409);

    expect(res.body.error.code).toBe('INVALID_STATE');
  });

});

// ─── POST /enrollments/:id/withdraw ──────────────────────────────────────────

describe('POST /enrollments/:id/withdraw', () => {

  it('200 — student withdraws their own pending enrollment', async () => {
    const enrollmentId = await createEnrollment();

    const res = await request(app)
      .post(`/enrollments/${enrollmentId}/withdraw`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    expect(res.body.state).toBe('withdrawn');
    expect(res.body.withdrawnAt).not.toBeNull();
  });

  it('200 — student withdraws an approved enrollment', async () => {
    const enrollmentId = await createEnrollment();
    await request(app)
      .post(`/admin/enrollments/${enrollmentId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    const res = await request(app)
      .post(`/enrollments/${enrollmentId}/withdraw`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    expect(res.body.state).toBe('withdrawn');
  });

  it('409 INVALID_STATE — cannot withdraw a rejected enrollment', async () => {
    const enrollmentId = await createEnrollment();
    await request(app)
      .post(`/admin/enrollments/${enrollmentId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Rejected' });

    const res = await request(app)
      .post(`/enrollments/${enrollmentId}/withdraw`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(409);

    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app).post('/enrollments/some-id/withdraw').expect(401);
  });

});

// ─── GET /admin/registrations ─────────────────────────────────────────────────

describe('GET /admin/registrations', () => {

  it('200 — admin lists registrations', async () => {
    await seedRegistration('reg-list-001', 'pending');
    await seedRegistration('reg-list-002', 'approved');

    const res = await request(app)
      .get('/admin/registrations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.items.length).toBeGreaterThanOrEqual(2);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
  });

  it('200 — supports ?status=pending filter', async () => {
    await seedRegistration('reg-filter-001', 'pending');
    await seedRegistration('reg-filter-002', 'approved');

    const res = await request(app)
      .get('/admin/registrations?status=pending')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const states = res.body.items.map((r: { state: string }) => r.state);
    expect(states.every((s: string) => s === 'pending')).toBe(true);
  });

  it('403 — student cannot list registrations', async () => {
    await request(app)
      .get('/admin/registrations')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app).get('/admin/registrations').expect(401);
  });

});

// ─── GET /enrollments/mine (V2 alias) ─────────────────────────────────────────

describe('GET /enrollments/mine', () => {

  it('200 — V2 alias returns student own enrollments', async () => {
    await createEnrollment();

    const res = await request(app)
      .get('/enrollments/mine')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.items[0].studentUid).toBe(studentUid);
  });

  it('200 — returns empty list when no enrollments', async () => {
    const res = await request(app)
      .get('/enrollments/mine')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    expect(res.body.items).toBeDefined();
  });

  it('403 — admin cannot use student enrollment alias', async () => {
    await request(app)
      .get('/enrollments/mine')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app).get('/enrollments/mine').expect(401);
  });

});
