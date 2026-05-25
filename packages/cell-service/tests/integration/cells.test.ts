/**
 * Integration tests for Cell Service -- Cell Groups, Join Requests, Cell Reports
 */
import request         from 'supertest';
import { v4 as uuid }  from 'uuid';
import { app }         from '../../src/app';
import { createTestUser, clearAuth, clearCollection } from '../../../../tests/integration/helpers';

let adminToken:  string;
let leaderToken: string;
let leaderUid:   string;
let memberToken: string;
let memberUid:   string;
let g12Uid:      string;

beforeAll(async () => {
  await clearAuth();
  const admin  = await createTestUser('admin@cell.test',  'Test@12345', 'admin',  ['admin']);
  const leader = await createTestUser('leader@cell.test', 'Test@12345', 'member', ['member', 'leader']);
  const member = await createTestUser('member@cell.test', 'Test@12345', 'member', ['member']);
  const g12    = await createTestUser('g12@cell.test',    'Test@12345', 'member', ['member', 'leader', 'g12']);
  adminToken  = admin.idToken;
  leaderToken = leader.idToken;
  leaderUid   = leader.uid;
  memberToken = member.idToken;
  memberUid   = member.uid;
  g12Uid      = g12.uid;
});

afterEach(async () => {
  await clearCollection('cell_groups');
  await clearCollection('outbox');
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('cell_groups');
  await clearCollection('outbox');
});

// ── helpers ──────────────────────────────────────────────────────────────────

async function createCell(name?: string): Promise<string> {
  const cellName = name ?? `Cell-${Date.now()}`;
  const res = await request(app)
    .post('/cells')
    .set('Authorization', `Bearer ${leaderToken}`)
    .send({ name: cellName, type: 'g12', area: 'Rathmalana', g12LeaderUid: g12Uid });
  return res.body.id as string;
}

const reportBody = {
  date:               '2026-05-17',
  didMeet:            true,
  leaderPresent:      true,
  location:           'Church Hall A',
  timeStarted:        '2026-05-17T18:00:00+05:30',
  timeEnded:          '2026-05-17T19:30:00+05:30',
  language:           'si',
  subjectDiscussed:   'sunday_sermon',
  cellType:           'g12',
  g12LeaderUid:       'g12-placeholder',
  attendance:         [],
  contactedAbsentees: true,
  additionalVisitors: 2,
  childrenCount:      1,
  satisfactionRate:   4,
};

async function fileReport(cellId: string, token: string): Promise<string> {
  const res = await request(app)
    .post('/cells/' + cellId + '/reports')
    .set('Authorization', 'Bearer ' + token)
    .set('X-Idempotency-Key', uuid())
    .send(reportBody)
    .expect(201);
  return res.body.id as string;
}

// ─── POST /cells ──────────────────────────────────────────────────────────────

describe('POST /cells', () => {

  it('201 -- leader creates a cell group', async () => {
    const res = await request(app)
      .post('/cells')
      .set('Authorization', 'Bearer ' + leaderToken)
      .send({ name: 'Rathmalana West G12', type: 'g12', area: 'Rathmalana', g12LeaderUid: g12Uid })
      .expect(201);

    expect(res.body.name).toBe('Rathmalana West G12');
    expect(res.body.state).toBe('active');
    expect(res.body.leaderUid).toBe(leaderUid);
    expect(res.body.members).toContain(leaderUid);
    expect(res.body.memberCount).toBe(1);
    expect(res.body.id).toBeDefined();
  });

  it('201 -- admin can create a cell', async () => {
    await request(app)
      .post('/cells')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ name: 'Admin Cell', type: 'care', area: 'Colombo', g12LeaderUid: g12Uid })
      .expect(201);
  });

  it('400 -- missing required fields', async () => {
    await request(app)
      .post('/cells')
      .set('Authorization', 'Bearer ' + leaderToken)
      .send({ name: 'Incomplete' })
      .expect(400);
  });

  it('403 -- member cannot create a cell', async () => {
    await request(app)
      .post('/cells')
      .set('Authorization', 'Bearer ' + memberToken)
      .send({ name: 'Unauthorized', type: 'care', area: 'X', g12LeaderUid: g12Uid })
      .expect(403);
  });

  it('401 -- unauthenticated rejected', async () => {
    await request(app).post('/cells').send({ name: 'X' }).expect(401);
  });

});

// ─── GET /cells ───────────────────────────────────────────────────────────────

describe('GET /cells', () => {

  it('200 -- any authenticated user can list active cells', async () => {
    await createCell('ListableCell');
    const res = await request(app)
      .get('/cells')
      .set('Authorization', 'Bearer ' + memberToken)
      .expect(200);
    expect(res.body.items).toBeInstanceOf(Array);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it('200 -- returns empty when no cells', async () => {
    const res = await request(app)
      .get('/cells')
      .set('Authorization', 'Bearer ' + memberToken)
      .expect(200);
    expect(res.body.items).toHaveLength(0);
  });

  it('401 -- unauthenticated rejected', async () => {
    await request(app).get('/cells').expect(401);
  });

});

// ─── GET /cells/mine ──────────────────────────────────────────────────────────

describe('GET /cells/mine', () => {

  it('200 -- leader sees cells they lead', async () => {
    await createCell('My Cell');
    const res = await request(app)
      .get('/cells/mine')
      .set('Authorization', 'Bearer ' + leaderToken)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body.some((c: { leaderUid: string }) => c.leaderUid === leaderUid)).toBe(true);
  });

  it('200 -- member with no cells gets empty array', async () => {
    const res = await request(app)
      .get('/cells/mine')
      .set('Authorization', 'Bearer ' + memberToken)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

});

// ─── GET /cells/:id ───────────────────────────────────────────────────────────

describe('GET /cells/:id', () => {

  it('200 -- leader gets own cell', async () => {
    const cellId = await createCell('Get Test Cell');
    const res = await request(app)
      .get('/cells/' + cellId)
      .set('Authorization', 'Bearer ' + leaderToken)
      .expect(200);
    expect(res.body.id).toBe(cellId);
    expect(res.body.members).toBeDefined();
  });

  it('200 -- admin can get any cell', async () => {
    const cellId = await createCell();
    await request(app)
      .get('/cells/' + cellId)
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200);
  });

  it('403 -- non-member non-admin cannot see cell details', async () => {
    const cellId = await createCell();
    await request(app)
      .get('/cells/' + cellId)
      .set('Authorization', 'Bearer ' + memberToken)
      .expect(403);
  });

  it('404 -- cell not found', async () => {
    await request(app)
      .get('/cells/no-such-id')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(404);
  });

});

// ─── PATCH /cells/:id ─────────────────────────────────────────────────────────

describe('PATCH /cells/:id', () => {

  it('200 -- leader updates cell name', async () => {
    const cellId = await createCell('Original Name');
    const res = await request(app)
      .patch('/cells/' + cellId)
      .set('Authorization', 'Bearer ' + leaderToken)
      .send({ name: 'Updated Name' })
      .expect(200);
    expect(res.body.name).toBe('Updated Name');
  });

  it('403 -- member cannot update a cell', async () => {
    const cellId = await createCell();
    await request(app)
      .patch('/cells/' + cellId)
      .set('Authorization', 'Bearer ' + memberToken)
      .send({ name: 'Hacked' })
      .expect(403);
  });

});

// ─── POST /cells/:id/archive ──────────────────────────────────────────────────

describe('POST /cells/:id/archive', () => {

  it('200 -- leader archives own cell', async () => {
    const cellId = await createCell();
    const res = await request(app)
      .post('/cells/' + cellId + '/archive')
      .set('Authorization', 'Bearer ' + leaderToken)
      .expect(200);
    expect(res.body.state).toBe('archived');
  });

  it('409 INVALID_STATE -- cannot archive already archived cell', async () => {
    const cellId = await createCell();
    await request(app).post('/cells/' + cellId + '/archive').set('Authorization', 'Bearer ' + leaderToken);
    const res = await request(app)
      .post('/cells/' + cellId + '/archive')
      .set('Authorization', 'Bearer ' + leaderToken)
      .expect(409);
    expect(res.body.error.code).toBe('INVALID_STATE');
  });

});

// ─── POST /cells/:id/members ──────────────────────────────────────────────────

describe('POST /cells/:id/members', () => {

  it('200 -- leader adds members to cell', async () => {
    const cellId = await createCell();
    const res = await request(app)
      .post('/cells/' + cellId + '/members')
      .set('Authorization', 'Bearer ' + leaderToken)
      .send({ userUids: [memberUid] })
      .expect(200);
    expect(res.body.added).toContain(memberUid);
    expect(res.body.memberCount).toBe(2);
  });

  it('400 -- missing userUids field', async () => {
    const cellId = await createCell();
    await request(app)
      .post('/cells/' + cellId + '/members')
      .set('Authorization', 'Bearer ' + leaderToken)
      .send({})
      .expect(400);
  });

  it('403 -- member cannot add members', async () => {
    const cellId = await createCell();
    await request(app)
      .post('/cells/' + cellId + '/members')
      .set('Authorization', 'Bearer ' + memberToken)
      .send({ userUids: ['some-uid'] })
      .expect(403);
  });

});

// ─── DELETE /cells/:id/members/:uid ──────────────────────────────────────────

describe('DELETE /cells/:id/members/:uid', () => {

  it('200 -- leader removes a member', async () => {
    const cellId = await createCell();
    await request(app)
      .post('/cells/' + cellId + '/members')
      .set('Authorization', 'Bearer ' + leaderToken)
      .send({ userUids: [memberUid] });
    const res = await request(app)
      .delete('/cells/' + cellId + '/members/' + memberUid)
      .set('Authorization', 'Bearer ' + leaderToken)
      .expect(200);
    expect(res.body.removed).toBe(memberUid);
    expect(res.body.memberCount).toBe(1);
  });

  it('404 -- cannot remove a non-member', async () => {
    const cellId = await createCell();
    await request(app)
      .delete('/cells/' + cellId + '/members/not-a-member')
      .set('Authorization', 'Bearer ' + leaderToken)
      .expect(404);
  });

});

// ─── POST /cells/:id/join-requests ───────────────────────────────────────────

describe('POST /cells/:id/join-requests', () => {

  it('201 -- member submits a join request', async () => {
    const cellId = await createCell();
    const res = await request(app)
      .post('/cells/' + cellId + '/join-requests')
      .set('Authorization', 'Bearer ' + memberToken)
      .send({ message: 'I would like to join.' })
      .expect(201);
    expect(res.body.requesterUid).toBe(memberUid);
    expect(res.body.status).toBe('pending');
    expect(res.body.cellId).toBe(cellId);
  });

  it('409 CELL_JOIN_REQUEST_PENDING -- duplicate pending request', async () => {
    const cellId = await createCell();
    await request(app)
      .post('/cells/' + cellId + '/join-requests')
      .set('Authorization', 'Bearer ' + memberToken)
      .send({ message: 'First' });
    const res = await request(app)
      .post('/cells/' + cellId + '/join-requests')
      .set('Authorization', 'Bearer ' + memberToken)
      .send({})
      .expect(409);
    expect(res.body.error.code).toBe('CELL_JOIN_REQUEST_PENDING');
  });

  it('403 -- admin cannot submit a join request (not member/student role)', async () => {
    const cellId = await createCell();
    await request(app)
      .post('/cells/' + cellId + '/join-requests')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({})
      .expect(403);
  });

  it('401 -- unauthenticated rejected', async () => {
    const cellId = await createCell();
    await request(app).post('/cells/' + cellId + '/join-requests').send({}).expect(401);
  });

});

// ─── POST /cells/:id/join-requests/:rid/approve ──────────────────────────────

describe('POST /cells/:id/join-requests/:rid/approve', () => {

  it('200 -- admin approves a join request, member added to cell', async () => {
    const cellId = await createCell();
    const jrRes  = await request(app)
      .post('/cells/' + cellId + '/join-requests')
      .set('Authorization', 'Bearer ' + memberToken)
      .send({});
    const res = await request(app)
      .post('/cells/' + cellId + '/join-requests/' + jrRes.body.id + '/approve')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ note: 'Welcome!' })
      .expect(200);
    expect(res.body.memberUid).toBe(memberUid);
    expect(res.body.memberCount).toBe(2);
  });

  it('409 INVALID_STATE -- cannot approve already-decided request', async () => {
    const cellId = await createCell();
    const jrRes  = await request(app)
      .post('/cells/' + cellId + '/join-requests')
      .set('Authorization', 'Bearer ' + memberToken)
      .send({});
    await request(app)
      .post('/cells/' + cellId + '/join-requests/' + jrRes.body.id + '/approve')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({});
    const res = await request(app)
      .post('/cells/' + cellId + '/join-requests/' + jrRes.body.id + '/approve')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({})
      .expect(409);
    expect(res.body.error.code).toBe('INVALID_STATE');
  });

});

// ─── POST /cells/:id/join-requests/:rid/reject ───────────────────────────────

describe('POST /cells/:id/join-requests/:rid/reject', () => {

  it('200 -- admin rejects a join request', async () => {
    const cellId = await createCell();
    const jrRes  = await request(app)
      .post('/cells/' + cellId + '/join-requests')
      .set('Authorization', 'Bearer ' + memberToken)
      .send({});
    const res = await request(app)
      .post('/cells/' + cellId + '/join-requests/' + jrRes.body.id + '/reject')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ note: 'Cell is full.' })
      .expect(200);
    expect(res.body.status).toBe('rejected');
    expect(res.body.decisionNote).toBe('Cell is full.');
  });

});

// ─── Cell Reports ─────────────────────────────────────────────────────────────

describe('POST /cells/:id/reports', () => {

  it('201 -- leader files a cell report', async () => {
    const cellId = await createCell();
    const key    = uuid();
    const res = await request(app)
      .post('/cells/' + cellId + '/reports')
      .set('Authorization', 'Bearer ' + leaderToken)
      .set('X-Idempotency-Key', key)
      .send(reportBody)
      .expect(201);
    expect(res.body.cellId).toBe(cellId);
    expect(res.body.filledByUid).toBe(leaderUid);
    expect(res.body.voided).toBe(false);
    expect(res.body.id).toBeDefined();
  });

  it('200 -- same idempotency key returns existing report', async () => {
    const cellId = await createCell();
    const key    = uuid();
    const first = await request(app)
      .post('/cells/' + cellId + '/reports')
      .set('Authorization', 'Bearer ' + leaderToken)
      .set('X-Idempotency-Key', key)
      .send(reportBody)
      .expect(201);
    const second = await request(app)
      .post('/cells/' + cellId + '/reports')
      .set('Authorization', 'Bearer ' + leaderToken)
      .set('X-Idempotency-Key', key)
      .send(reportBody)
      .expect(200);
    expect(second.body.id).toBe(first.body.id);
  });

  it('403 -- regular admin cannot file a report', async () => {
    const cellId = await createCell();
    await request(app)
      .post('/cells/' + cellId + '/reports')
      .set('Authorization', 'Bearer ' + adminToken)
      .set('X-Idempotency-Key', uuid())
      .send(reportBody)
      .expect(403);
  });

  it('403 -- member cannot file a report', async () => {
    const cellId = await createCell();
    await request(app)
      .post('/cells/' + cellId + '/reports')
      .set('Authorization', 'Bearer ' + memberToken)
      .set('X-Idempotency-Key', uuid())
      .send(reportBody)
      .expect(403);
  });

});

describe('GET /cells/:id/reports', () => {

  it('200 -- leader lists reports for own cell', async () => {
    const cellId    = await createCell();
    await fileReport(cellId, leaderToken);
    const res = await request(app)
      .get('/cells/' + cellId + '/reports')
      .set('Authorization', 'Bearer ' + leaderToken)
      .expect(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('403 -- non-member non-admin cannot list reports', async () => {
    const cellId = await createCell();
    await request(app)
      .get('/cells/' + cellId + '/reports')
      .set('Authorization', 'Bearer ' + memberToken)
      .expect(403);
  });

});

describe('POST /cells/:id/reports/:rid/void', () => {

  it('200 -- leader voids a report', async () => {
    const cellId   = await createCell();
    const reportId = await fileReport(cellId, leaderToken);
    const res = await request(app)
      .post('/cells/' + cellId + '/reports/' + reportId + '/void')
      .set('Authorization', 'Bearer ' + leaderToken)
      .send({ reason: 'Wrong date entered.' })
      .expect(200);
    expect(res.body.voided).toBe(true);
  });

  it('409 REPORT_ALREADY_VOIDED -- cannot void twice', async () => {
    const cellId   = await createCell();
    const reportId = await fileReport(cellId, leaderToken);
    await request(app)
      .post('/cells/' + cellId + '/reports/' + reportId + '/void')
      .set('Authorization', 'Bearer ' + leaderToken)
      .send({ reason: 'First void' });
    const res = await request(app)
      .post('/cells/' + cellId + '/reports/' + reportId + '/void')
      .set('Authorization', 'Bearer ' + leaderToken)
      .send({ reason: 'Second void' })
      .expect(409);
    expect(res.body.error.code).toBe('REPORT_ALREADY_VOIDED');
  });

});

// ─── GET /cells/:id/join-requests ────────────────────────────────────────────

describe('GET /cells/:id/join-requests', () => {

  it('200 -- leader lists pending join requests for own cell', async () => {
    const cellId = await createCell();
    await request(app)
      .post('/cells/' + cellId + '/join-requests')
      .set('Authorization', 'Bearer ' + memberToken)
      .send({});

    const res = await request(app)
      .get('/cells/' + cellId + '/join-requests')
      .set('Authorization', 'Bearer ' + leaderToken)
      .expect(200);

    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.items[0].cellId).toBe(cellId);
    expect(res.body.items[0].status).toBe('pending');
  });

  it('200 -- admin lists join requests', async () => {
    const cellId = await createCell();
    await request(app)
      .post('/cells/' + cellId + '/join-requests')
      .set('Authorization', 'Bearer ' + memberToken)
      .send({});

    const res = await request(app)
      .get('/cells/' + cellId + '/join-requests')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200);

    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('200 -- returns empty list when no join requests', async () => {
    const cellId = await createCell();

    const res = await request(app)
      .get('/cells/' + cellId + '/join-requests')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200);

    expect(res.body.items).toHaveLength(0);
  });

  it('403 -- member cannot list join requests', async () => {
    const cellId = await createCell();
    await request(app)
      .get('/cells/' + cellId + '/join-requests')
      .set('Authorization', 'Bearer ' + memberToken)
      .expect(403);
  });

  it('401 -- unauthenticated request rejected', async () => {
    await request(app).get('/cells/any-id/join-requests').expect(401);
  });

});

// ─── GET /cells/:id/reports/:rid ─────────────────────────────────────────────

describe('GET /cells/:id/reports/:rid', () => {

  it('200 -- leader fetches a specific report by ID', async () => {
    const cellId   = await createCell();
    const reportId = await fileReport(cellId, leaderToken);

    const res = await request(app)
      .get('/cells/' + cellId + '/reports/' + reportId)
      .set('Authorization', 'Bearer ' + leaderToken)
      .expect(200);

    expect(res.body.id).toBe(reportId);
    expect(res.body.cellId).toBe(cellId);
    expect(res.body.voided).toBe(false);
  });

  it('200 -- admin fetches a specific report by ID', async () => {
    const cellId   = await createCell();
    const reportId = await fileReport(cellId, leaderToken);

    const res = await request(app)
      .get('/cells/' + cellId + '/reports/' + reportId)
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200);

    expect(res.body.id).toBe(reportId);
  });

  it('404 -- report not found', async () => {
    const cellId = await createCell();
    await request(app)
      .get('/cells/' + cellId + '/reports/no-such-report')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(404);
  });

  it('403 -- non-member cannot fetch report', async () => {
    const cellId   = await createCell();
    const reportId = await fileReport(cellId, leaderToken);
    await request(app)
      .get('/cells/' + cellId + '/reports/' + reportId)
      .set('Authorization', 'Bearer ' + memberToken)
      .expect(403);
  });

  it('401 -- unauthenticated request rejected', async () => {
    await request(app).get('/cells/any-id/reports/any-rid').expect(401);
  });

});
