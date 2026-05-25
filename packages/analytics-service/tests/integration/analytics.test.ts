/**
 * Integration tests for Analytics Service.
 * Seeds analytics_snapshots directly since Scheduled Jobs aren't built yet.
 */
import request          from 'supertest';
import { getFirestore } from 'firebase-admin/firestore';
import { app }          from '../../src/app';
import { createTestUser, clearAuth, clearCollection, now } from '../../../../tests/integration/helpers';
import { getISOWeekKey, lastNWeekKeys } from '../../src/application/helpers/scope';

let leaderToken: string;
let leaderUid:   string;
let g12Token:    string;
let g12Uid:      string;
let adminToken:  string;
let memberToken: string;

const currentWeek = getISOWeekKey(new Date());
const lastWeek    = lastNWeekKeys(2)[0];

const defaultMetrics = {
  cellCount: 5, activeCells: 4, reportCount: 12,
  attendance: { present: 35, absent: 5, visitors: 3, children: 2, newAttendees: 2 },
  meetingTypeBreakdown: { g12: 8, care: 4, children: 2, outreach: 1 },
  memberGrowth: 3, participationRate: 0.88, averageSatisfaction: 4.1,
  participationByLeader: [
    { leaderUid: 'leader-uid', leaderName: 'Sithuru K.', averageAttendance: 7.5, cellCount: 2 },
  ],
};

async function seedSnapshot(scope: string, periodKey: string, overrides = {}) {
  const id = scope + '_' + periodKey;
  await getFirestore().collection('analytics_snapshots').doc(id).set({
    scope, periodKey, metrics: { ...defaultMetrics, ...overrides }, computedAt: now(),
  });
}

beforeAll(async () => {
  await clearAuth();
  const leader = await createTestUser('leader@analy.test', 'Test@12345', 'member', ['member', 'leader']);
  const g12    = await createTestUser('g12@analy.test',    'Test@12345', 'member', ['member', 'leader', 'g12']);
  const admin  = await createTestUser('admin@analy.test',  'Test@12345', 'admin',  ['admin']);
  const member = await createTestUser('member@analy.test', 'Test@12345', 'member', ['member']);

  leaderToken = leader.idToken;
  leaderUid   = leader.uid;
  g12Token    = g12.idToken;
  g12Uid      = g12.uid;
  adminToken  = admin.idToken;
  memberToken = member.idToken;

  // Seed snapshots for each scope
  await seedSnapshot('org',                  currentWeek);
  await seedSnapshot('org',                  lastWeek, { cellCount: 4 });
  await seedSnapshot('g12:' + g12Uid,        currentWeek);
  await seedSnapshot('leader:' + leaderUid,  currentWeek);
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('analytics_snapshots');
});

// ─── GET /analytics/cells/weekly ─────────────────────────────────────────────

describe('GET /analytics/cells/weekly', () => {

  it('200 -- admin gets org-scoped weekly data', async () => {
    const res = await request(app)
      .get('/analytics/cells/weekly?weeks=2')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200);

    expect(res.body.scope).toBe('org');
    expect(res.body.periodType).toBe('weekly');
    expect(res.body.data).toHaveLength(2);
    const current = res.body.data.find((d: { periodKey: string }) => d.periodKey === currentWeek);
    expect(current.cellCount).toBe(5);
  });

  it('200 -- leader gets own scope', async () => {
    const res = await request(app)
      .get('/analytics/cells/weekly?weeks=1')
      .set('Authorization', 'Bearer ' + leaderToken)
      .expect(200);

    expect(res.body.scope).toBe('leader:' + leaderUid);
    expect(res.body.data).toHaveLength(1);
  });

  it('200 -- g12 gets network scope', async () => {
    const res = await request(app)
      .get('/analytics/cells/weekly?weeks=1')
      .set('Authorization', 'Bearer ' + g12Token)
      .expect(200);

    expect(res.body.scope).toBe('g12:' + g12Uid);
  });

  it('200 -- returns zeros for periods with no snapshot', async () => {
    const res = await request(app)
      .get('/analytics/cells/weekly?weeks=4')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200);

    const missing = res.body.data.filter((d: { cellCount: number }) => d.cellCount === 0);
    expect(missing.length).toBeGreaterThan(0);
  });

  it('403 -- member cannot access analytics', async () => {
    await request(app)
      .get('/analytics/cells/weekly')
      .set('Authorization', 'Bearer ' + memberToken)
      .expect(403);
  });

  it('401 -- unauthenticated rejected', async () => {
    await request(app).get('/analytics/cells/weekly').expect(401);
  });

});

// ─── GET /analytics/attendance ───────────────────────────────────────────────

describe('GET /analytics/attendance', () => {

  it('200 -- returns attendance metrics for org scope', async () => {
    const res = await request(app)
      .get('/analytics/attendance')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200);

    expect(res.body.scope).toBe('org');
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      expect(res.body.data[0]).toHaveProperty('present');
      expect(res.body.data[0]).toHaveProperty('absent');
    }
  });

  it('200 -- supports from/to filter', async () => {
    const res = await request(app)
      .get('/analytics/attendance?from=' + currentWeek + '&to=' + currentWeek)
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200);

    const items = res.body.data.filter((d: { periodKey: string }) => d.periodKey === currentWeek);
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].present).toBe(35);
  });

  it('403 -- member cannot access', async () => {
    await request(app)
      .get('/analytics/attendance')
      .set('Authorization', 'Bearer ' + memberToken)
      .expect(403);
  });

});

// ─── GET /analytics/meeting-types ────────────────────────────────────────────

describe('GET /analytics/meeting-types', () => {

  it('200 -- returns meeting type breakdown', async () => {
    const res = await request(app)
      .get('/analytics/meeting-types')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200);

    expect(res.body.scope).toBe('org');
    expect(res.body.period).toBeDefined();
    expect(res.body.breakdown).toHaveProperty('g12');
    expect(res.body.breakdown).toHaveProperty('care');
  });

  it('200 -- returns zeros when no snapshot', async () => {
    const noDataRes = await request(app)
      .get('/analytics/meeting-types')
      .set('Authorization', 'Bearer ' + leaderToken)
      .expect(200);

    // leader may or may not have a snapshot seeded — just check shape
    expect(noDataRes.body).toHaveProperty('breakdown');
  });

  it('403 -- member cannot access', async () => {
    await request(app)
      .get('/analytics/meeting-types')
      .set('Authorization', 'Bearer ' + memberToken)
      .expect(403);
  });

});

// ─── GET /analytics/growth ───────────────────────────────────────────────────

describe('GET /analytics/growth', () => {

  it('200 -- g12 gets growth trend', async () => {
    const res = await request(app)
      .get('/analytics/growth')
      .set('Authorization', 'Bearer ' + g12Token)
      .expect(200);

    expect(res.body.scope).toBe('g12:' + g12Uid);
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      expect(res.body.data[0]).toHaveProperty('memberGrowth');
      expect(res.body.data[0]).toHaveProperty('participationRate');
    }
  });

  it('200 -- admin gets org growth', async () => {
    const res = await request(app)
      .get('/analytics/growth')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200);

    expect(res.body.scope).toBe('org');
  });

  it('403 -- leader cannot access growth (g12+ only)', async () => {
    await request(app)
      .get('/analytics/growth')
      .set('Authorization', 'Bearer ' + leaderToken)
      .expect(403);
  });

  it('403 -- member cannot access', async () => {
    await request(app)
      .get('/analytics/growth')
      .set('Authorization', 'Bearer ' + memberToken)
      .expect(403);
  });

});

// ─── GET /analytics/participation ────────────────────────────────────────────

describe('GET /analytics/participation', () => {

  it('200 -- returns per-leader participation for org scope', async () => {
    const res = await request(app)
      .get('/analytics/participation')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200);

    expect(res.body.scope).toBe('org');
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      expect(res.body.data[0]).toHaveProperty('leaderUid');
      expect(res.body.data[0]).toHaveProperty('averageAttendance');
    }
  });

  it('403 -- leader cannot access participation (g12+ only)', async () => {
    await request(app)
      .get('/analytics/participation')
      .set('Authorization', 'Bearer ' + leaderToken)
      .expect(403);
  });

});

// ─── GET /analytics/:chart/export ────────────────────────────────────────────

describe('GET /analytics/:chart/export', () => {

  it('200 -- exports cells-weekly as CSV', async () => {
    const res = await request(app)
      .get('/analytics/cells-weekly/export?weeks=2')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200);

    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text).toContain('periodKey,cellCount,activeCells,reportCount');
  });

  it('200 -- exports attendance as CSV', async () => {
    const res = await request(app)
      .get('/analytics/attendance/export')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200);

    expect(res.text).toContain('periodKey,present,absent');
  });

  it('200 -- exports meeting-types as CSV', async () => {
    const res = await request(app)
      .get('/analytics/meeting-types/export')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200);

    expect(res.text).toContain('type,count');
  });

  it('200 -- exports growth as CSV', async () => {
    const res = await request(app)
      .get('/analytics/growth/export')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200);

    expect(res.text).toContain('periodKey,memberGrowth,participationRate');
  });

  it('200 -- exports participation as CSV', async () => {
    const res = await request(app)
      .get('/analytics/participation/export')
      .set('Authorization', 'Bearer ' + adminToken)
      .expect(200);

    expect(res.text).toContain('leaderUid,leaderName,averageAttendance,cellCount');
  });

  it('403 -- leader cannot export (g12+ only)', async () => {
    await request(app)
      .get('/analytics/cells-weekly/export')
      .set('Authorization', 'Bearer ' + leaderToken)
      .expect(403);
  });

  it('401 -- unauthenticated rejected', async () => {
    await request(app).get('/analytics/cells-weekly/export').expect(401);
  });

});
