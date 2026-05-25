import request          from 'supertest';
import { getFirestore } from 'firebase-admin/firestore';
import { app }          from '../../src/app';
import { createTestUser, clearAuth, clearCollection, now } from '../../../../tests/integration/helpers';

let adminToken:  string;
let targetUid:   string;

async function seedUser(uid: string, roles: string[] = ['member']) {
  await getFirestore().collection('users').doc(uid).set({
    email: `${uid}@test.com`, firstName: 'Test', lastName: 'User',
    role: roles[0], roles, status: 'approved',
    profilePhotoUrl: null, preferredLanguage: 'en',
    fcmTokens: [], createdAt: now(), updatedAt: now(), deletedAt: null,
  });
}

beforeAll(async () => {
  await clearAuth();
  await clearCollection('users');

  const admin  = await createTestUser('admin@roles.test',  'Test@12345', 'admin',  ['admin']);
  const target = await createTestUser('target@roles.test', 'Test@12345', 'member', ['member']);

  adminToken = admin.idToken;
  targetUid  = target.uid;

  await seedUser(admin.uid,  ['admin']);
  await seedUser(target.uid, ['member']);
});

afterEach(async () => {
  // Reset target user roles back to ['member'] after each test
  await getFirestore().collection('users').doc(targetUid).update({
    roles: ['member'], role: 'member', updatedAt: now(),
  });
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('users');
});

// ─── PATCH /users/:uid/roles ──────────────────────────────────────────────────

describe('PATCH /users/:uid/roles', () => {

  it('204 — admin adds student role to a member', async () => {
    await request(app)
      .patch(`/users/${targetUid}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'student', action: 'add' })
      .expect(204);

    const doc = await getFirestore().collection('users').doc(targetUid).get();
    expect(doc.data()?.roles).toContain('student');
    expect(doc.data()?.roles).toContain('member');
  });

  it('204 — admin adds leader role', async () => {
    await request(app)
      .patch(`/users/${targetUid}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'leader', action: 'add' })
      .expect(204);

    const doc = await getFirestore().collection('users').doc(targetUid).get();
    expect(doc.data()?.roles).toContain('leader');
  });

  it('204 — admin removes a role', async () => {
    // First add the role
    await request(app)
      .patch(`/users/${targetUid}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'student', action: 'add' });

    // Then remove it
    await request(app)
      .patch(`/users/${targetUid}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'student', action: 'remove' })
      .expect(204);

    const doc = await getFirestore().collection('users').doc(targetUid).get();
    expect(doc.data()?.roles).not.toContain('student');
    expect(doc.data()?.roles).toContain('member');
  });

  it('204 — idempotent: adding an existing role does not duplicate', async () => {
    // member already has 'member' role
    await request(app)
      .patch(`/users/${targetUid}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'member', action: 'add' })
      .expect(204);

    const doc = await getFirestore().collection('users').doc(targetUid).get();
    const memberCount = (doc.data()?.roles as string[]).filter((r: string) => r === 'member').length;
    expect(memberCount).toBe(1);
  });

  it('400 — cannot remove the member role (permanent)', async () => {
    const res = await request(app)
      .patch(`/users/${targetUid}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'member', action: 'remove' })
      .expect(400);

    expect(res.body.error.code).toBe('INVALID_ROLE');
  });

  it('400 — invalid role name rejected by validator', async () => {
    await request(app)
      .patch(`/users/${targetUid}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'supervillain', action: 'add' })
      .expect(400);
  });

  it('400 — missing action field', async () => {
    await request(app)
      .patch(`/users/${targetUid}/roles`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'student' })
      .expect(400);
  });

  it('404 — user not found', async () => {
    await request(app)
      .patch('/users/no-such-uid/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'student', action: 'add' })
      .expect(404);
  });

  it('403 — member cannot assign roles', async () => {
    const { idToken } = await createTestUser('member2@roles.test', 'Test@12345', 'member', ['member']);

    await request(app)
      .patch(`/users/${targetUid}/roles`)
      .set('Authorization', `Bearer ${idToken}`)
      .send({ role: 'student', action: 'add' })
      .expect(403);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app)
      .patch(`/users/${targetUid}/roles`)
      .send({ role: 'student', action: 'add' })
      .expect(401);
  });

});

// ─── POST /me/fcm-token ───────────────────────────────────────────────────────

describe('POST /me/fcm-token', () => {

  it('204 — member registers an FCM token', async () => {
    const { uid, idToken } = await createTestUser('fcm@test.com', 'Test@12345', 'member', ['member']);
    await seedUser(uid, ['member']);

    await request(app)
      .post('/me/fcm-token')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ token: 'fcm-device-token-abc123' })
      .expect(204);

    const doc = await getFirestore().collection('users').doc(uid).get();
    expect(doc.data()?.fcmTokens).toContain('fcm-device-token-abc123');
  });

  it('204 — idempotent: same token registered twice does not duplicate', async () => {
    const { uid, idToken } = await createTestUser('fcm2@test.com', 'Test@12345', 'member', ['member']);
    await seedUser(uid, ['member']);

    await request(app)
      .post('/me/fcm-token')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ token: 'same-token' });

    await request(app)
      .post('/me/fcm-token')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ token: 'same-token' })
      .expect(204);

    const doc = await getFirestore().collection('users').doc(uid).get();
    const count = (doc.data()?.fcmTokens as string[]).filter((t: string) => t === 'same-token').length;
    expect(count).toBe(1);
  });

  it('400 — missing token field', async () => {
    const { idToken } = await createTestUser('fcm3@test.com', 'Test@12345', 'member', ['member']);

    await request(app)
      .post('/me/fcm-token')
      .set('Authorization', `Bearer ${idToken}`)
      .send({})
      .expect(400);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app)
      .post('/me/fcm-token')
      .send({ token: 'abc' })
      .expect(401);
  });

});
