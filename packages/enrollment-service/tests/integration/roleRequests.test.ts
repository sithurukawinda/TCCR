import request from 'supertest';
import { app } from '../../src/app';
import { createTestUser, clearAuth, clearCollection } from '../../../../tests/integration/helpers';

// Mock UserServiceClient — addRole makes HTTP call to user-service
jest.mock('../../src/infrastructure/clients/UserServiceClient', () => ({
  UserServiceClient: jest.fn().mockImplementation(() => ({
    approveUser: jest.fn().mockResolvedValue(undefined),
    addRole:     jest.fn().mockResolvedValue(undefined),
  })),
}));

let memberToken:  string;
let memberUid:    string;
let adminToken:   string;
let studentToken: string;

beforeAll(async () => {
  await clearAuth();
  const member  = await createTestUser('member@rr.test',  'Test@12345', 'member',  ['member']);
  const admin   = await createTestUser('admin@rr.test',   'Test@12345', 'admin',   ['admin']);
  const student = await createTestUser('student@rr.test', 'Test@12345', 'student', ['member', 'student']);
  memberToken  = member.idToken;
  memberUid    = member.uid;
  adminToken   = admin.idToken;
  studentToken = student.idToken;
});

afterEach(async () => {
  await clearCollection('role_requests');
  await clearCollection('outbox');
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('role_requests');
  await clearCollection('outbox');
});

// ─── POST /role-requests ──────────────────────────────────────────────────────

describe('POST /role-requests', () => {

  it('201 — member creates a pending role request for student role', async () => {
    const res = await request(app)
      .post('/role-requests')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ requestedRole: 'student' })
      .expect(201);

    expect(res.body.requesterUid).toBe(memberUid);
    expect(res.body.requestedRole).toBe('student');
    expect(res.body.status).toBe('pending');
    expect(res.body.id).toBeDefined();
    expect(res.body.createdAt).toBeDefined();
  });

  it('409 ROLE_REQUEST_PENDING — duplicate request while one is already pending', async () => {
    await request(app)
      .post('/role-requests')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ requestedRole: 'student' });

    const res = await request(app)
      .post('/role-requests')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ requestedRole: 'student' })
      .expect(409);

    expect(res.body.error.code).toBe('ROLE_REQUEST_PENDING');
  });

  it('400 — missing requestedRole body field', async () => {
    await request(app)
      .post('/role-requests')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({})
      .expect(400);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app)
      .post('/role-requests')
      .send({ requestedRole: 'student' })
      .expect(401);
  });

});

// ─── GET /role-requests/mine ─────────────────────────────────────────────────

describe('GET /role-requests/mine', () => {

  it('200 — member sees their own pending request', async () => {
    await request(app)
      .post('/role-requests')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ requestedRole: 'student' });

    const res = await request(app)
      .get('/role-requests/mine')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    // Returns plain array (not paginated object)
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].requesterUid).toBe(memberUid);
  });

  it('200 — returns empty array when no requests exist', async () => {
    const res = await request(app)
      .get('/role-requests/mine')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app)
      .get('/role-requests/mine')
      .expect(401);
  });

});

// ─── GET /role-requests (admin) ───────────────────────────────────────────────

describe('GET /role-requests', () => {

  it('200 — admin sees all pending role requests', async () => {
    await request(app)
      .post('/role-requests')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ requestedRole: 'student' });

    const res = await request(app)
      .get('/role-requests')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it('200 — supports ?status=pending filter', async () => {
    await request(app)
      .post('/role-requests')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ requestedRole: 'student' });

    const res = await request(app)
      .get('/role-requests?status=pending')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const statuses = res.body.items.map((r: { status: string }) => r.status);
    expect(statuses.every((s: string) => s === 'pending')).toBe(true);
  });

  it('403 — student cannot list all role requests', async () => {
    await request(app)
      .get('/role-requests')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app)
      .get('/role-requests')
      .expect(401);
  });

});

// ─── POST /role-requests/:id/approve ─────────────────────────────────────────

describe('POST /role-requests/:id/approve', () => {

  it('200 — admin approves a pending request', async () => {
    const createRes = await request(app)
      .post('/role-requests')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ requestedRole: 'student' });

    const reqId = createRes.body.id as string;

    const approveRes = await request(app)
      .post(`/role-requests/${reqId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'Welcome to Bible School!' })
      .expect(200);

    expect(approveRes.body.status).toBe('approved');
    expect(approveRes.body.decidedByUid).toBeDefined();
    expect(approveRes.body.decisionNote).toBe('Welcome to Bible School!');
    expect(approveRes.body.decidedAt).not.toBeNull();
  });

  it('409 INVALID_STATE — cannot approve an already-approved request', async () => {
    const createRes = await request(app)
      .post('/role-requests')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ requestedRole: 'student' });

    const reqId = createRes.body.id as string;

    await request(app)
      .post(`/role-requests/${reqId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    const res = await request(app)
      .post(`/role-requests/${reqId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(409);

    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  it('404 — approve non-existent request', async () => {
    await request(app)
      .post('/role-requests/does-not-exist/approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(404);
  });

  it('403 — member cannot approve requests', async () => {
    const createRes = await request(app)
      .post('/role-requests')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ requestedRole: 'student' });

    await request(app)
      .post(`/role-requests/${createRes.body.id}/approve`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({})
      .expect(403);
  });

});

// ─── POST /role-requests/:id/reject ──────────────────────────────────────────

describe('POST /role-requests/:id/reject', () => {

  it('200 — admin rejects a pending request', async () => {
    const createRes = await request(app)
      .post('/role-requests')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ requestedRole: 'student' });

    const reqId = createRes.body.id as string;

    const rejectRes = await request(app)
      .post(`/role-requests/${reqId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'Batch is full. Apply next intake.' })
      .expect(200);

    expect(rejectRes.body.status).toBe('rejected');
    expect(rejectRes.body.decisionNote).toBe('Batch is full. Apply next intake.');
    expect(rejectRes.body.decidedAt).not.toBeNull();
  });

  it('409 INVALID_STATE — cannot reject an already-rejected request', async () => {
    const createRes = await request(app)
      .post('/role-requests')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ requestedRole: 'student' });

    const reqId = createRes.body.id as string;

    await request(app)
      .post(`/role-requests/${reqId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'First rejection' });

    const res = await request(app)
      .post(`/role-requests/${reqId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'Second rejection' })
      .expect(409);

    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  it('404 — reject non-existent request', async () => {
    await request(app)
      .post('/role-requests/no-such-id/reject')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(404);
  });

});

// ─── GET /role-requests/:id ───────────────────────────────────────────────────

describe('GET /role-requests/:id', () => {

  it('200 — admin fetches a specific role request by ID', async () => {
    const createRes = await request(app)
      .post('/role-requests')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ requestedRole: 'student' });

    const reqId = createRes.body.id as string;

    const res = await request(app)
      .get(`/role-requests/${reqId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.id).toBe(reqId);
    expect(res.body.requesterUid).toBe(memberUid);
    expect(res.body.status).toBe('pending');
    expect(res.body.requestedRole).toBe('student');
  });

  it('404 — non-existent role request', async () => {
    await request(app)
      .get('/role-requests/does-not-exist')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('403 — member cannot fetch a specific role request by ID', async () => {
    const createRes = await request(app)
      .post('/role-requests')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ requestedRole: 'student' });

    await request(app)
      .get(`/role-requests/${createRes.body.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(403);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app).get('/role-requests/any-id').expect(401);
  });

});
