import request        from 'supertest';
import { getFirestore } from 'firebase-admin/firestore';
import { app }         from '../../src/app';
import { createTestUser, clearAuth, clearCollection, now } from '../../../../tests/integration/helpers';

let superAdminToken: string;
let adminToken:      string;

beforeAll(async () => {
  await clearAuth();
  const sa  = await createTestUser('superadmin@audit.test', 'Test@12345', 'super_admin');
  const adm = await createTestUser('admin@audit.test',      'Test@12345', 'admin');
  superAdminToken = sa.idToken;
  adminToken      = adm.idToken;
});

beforeEach(async () => {
  await clearCollection('audit_log');
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('audit_log');
});

async function seedAuditEntry(actorUid: string, action: string): Promise<void> {
  await getFirestore().collection('audit_log').add({
    actorUid, action, targetType: 'user', targetId: 'uid-1',
    payload: {}, requestId: 'req-1', createdAt: now(),
  });
}

describe('GET /audit-log', () => {

  it('200 — super_admin can query audit log', async () => {
    await seedAuditEntry('admin-uid', 'registration.approved');
    await seedAuditEntry('admin-uid', 'enrollment.approved');

    const res = await request(app)
      .get('/audit-log')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(res.body.items.length).toBeGreaterThanOrEqual(2);
  });

  it('200 — filters by actorUid', async () => {
    await seedAuditEntry('actor-a', 'registration.approved');
    await seedAuditEntry('actor-b', 'enrollment.approved');

    const res = await request(app)
      .get('/audit-log?actorUid=actor-a')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(res.body.items.every((e: { actor: { uid: string } }) => e.actor.uid === 'actor-a')).toBe(true);
  });

  it('200 — cursor pagination works', async () => {
    for (let i = 0; i < 5; i++) await seedAuditEntry('actor', `action-${i}`);

    const page1 = await request(app)
      .get('/audit-log?limit=2')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(page1.body.items.length).toBe(2);

    if (page1.body.nextCursor) {
      const page2 = await request(app)
        .get(`/audit-log?limit=2&cursor=${page1.body.nextCursor}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      expect(page2.body.items.length).toBeGreaterThan(0);
    }
  });

  it('200 — admin can also access audit log (V2: both admin and super_admin allowed)', async () => {
    await seedAuditEntry('actor', 'enrollment.approved');

    const res = await request(app)
      .get('/audit-log')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.items).toBeInstanceOf(Array);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app).get('/audit-log').expect(401);
  });

});

describe('POST /internal/events', () => {

  it('204 — receives and stores audit.action event', async () => {
    await request(app)
      .post('/internal/events')
      .set('x-internal-service-key', 'test-secret')
      .send({
        eventType: 'audit.action',
        payload:   { action: 'registration.approved', actorUid: 'admin-uid', targetType: 'user', targetId: 'uid-1' },
        requestId: 'req-test',
      })
      .expect(204);

    const snap = await getFirestore().collection('audit_log').get();
    expect(snap.empty).toBe(false);
  });

  it('401 — rejects request without internal key', async () => {
    await request(app)
      .post('/internal/events')
      .send({ eventType: 'audit.action', payload: {}, requestId: 'r' })
      .expect(401);
  });

});
