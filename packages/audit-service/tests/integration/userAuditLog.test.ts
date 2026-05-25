/**
 * Integration tests for GET /users/:uid/audit-log (V2 per-user audit timeline)
 */
import request          from 'supertest';
import { getFirestore } from 'firebase-admin/firestore';
import { app }          from '../../src/app';
import { createTestUser, clearAuth, clearCollection } from '../../../../tests/integration/helpers';

let superAdminToken: string;
let adminToken:      string;
let studentToken:    string;
let targetUid:       string;

async function seedAuditEntry(actorUid: string, action: string) {
  await getFirestore().collection('audit_log').add({
    actorUid, actorEmail: `${actorUid}@test.com`,
    action, category: 'test',
    targetType: 'user', targetId: targetUid,
    payload: {}, requestId: 'req-test',
    createdAt: new Date().toISOString(),
  });
}

beforeAll(async () => {
  await clearAuth();
  const sa      = await createTestUser('super@audit.test',   'Test@12345', 'super_admin', ['super_admin']);
  const admin   = await createTestUser('admin@audit.test',   'Test@12345', 'admin',       ['admin']);
  const student = await createTestUser('student@audit.test', 'Test@12345', 'student',     ['member', 'student']);
  superAdminToken = sa.idToken;
  adminToken      = admin.idToken;
  studentToken    = student.idToken;
  targetUid       = student.uid;
});

afterEach(async () => {
  await clearCollection('audit_log');
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('audit_log');
});

describe('GET /users/:uid/audit-log', () => {

  it('200 — super_admin gets per-user audit log', async () => {
    await seedAuditEntry(targetUid, 'enrollment.approved');
    await seedAuditEntry(targetUid, 'role.granted');

    const res = await request(app)
      .get(`/users/${targetUid}/audit-log`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(res.body.items).toBeInstanceOf(Array);
    expect(res.body.items.length).toBe(2);
    expect(res.body.total).toBe(2);
    expect(res.body.items[0]).toHaveProperty('when');
    expect(res.body.items[0]).toHaveProperty('actor');
    expect(res.body.items[0]).toHaveProperty('action');
  });

  it('200 — admin can also view per-user audit log', async () => {
    await seedAuditEntry(targetUid, 'enrollment.approved');

    const res = await request(app)
      .get(`/users/${targetUid}/audit-log`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.items).toBeInstanceOf(Array);
    expect(res.body.items.length).toBe(1);
  });

  it('200 — returns empty list when user has no audit entries', async () => {
    const res = await request(app)
      .get(`/users/${targetUid}/audit-log`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.items).toHaveLength(0);
    expect(res.body.total).toBe(0);
    expect(res.body.nextCursor).toBeNull();
  });

  it('200 — only returns entries for the specified UID, not others', async () => {
    await seedAuditEntry(targetUid, 'enrollment.approved');
    await seedAuditEntry('other-user-uid', 'role.granted');

    const res = await request(app)
      .get(`/users/${targetUid}/audit-log`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.items.length).toBe(1);
    expect(res.body.items.every((i: { actor: { uid: string } }) => i.actor.uid === targetUid)).toBe(true);
  });

  it('200 — supports ?action= filter', async () => {
    await seedAuditEntry(targetUid, 'enrollment.approved');
    await seedAuditEntry(targetUid, 'role.granted');

    const res = await request(app)
      .get(`/users/${targetUid}/audit-log?action=role.granted`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].action).toBe('role.granted');
  });

  it('200 — supports ?limit= pagination', async () => {
    await seedAuditEntry(targetUid, 'action.one');
    await seedAuditEntry(targetUid, 'action.two');
    await seedAuditEntry(targetUid, 'action.three');

    const res = await request(app)
      .get(`/users/${targetUid}/audit-log?limit=2`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBe(3);
    expect(res.body.nextCursor).not.toBeNull();
  });

  it('403 — student cannot view audit log', async () => {
    await request(app)
      .get(`/users/${targetUid}/audit-log`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app)
      .get(`/users/${targetUid}/audit-log`)
      .expect(401);
  });

});
