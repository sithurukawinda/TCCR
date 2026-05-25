/**
 * Integration tests for user management endpoints:
 * - GET /users/:uid, POST /users/:uid/suspend, POST /users/:uid/reactivate
 * - POST /me/change-password
 * - Super Admin: GET/suspend/reactivate/delete /super-admin/admins, make-admin
 */
import request          from 'supertest';
import { getFirestore } from 'firebase-admin/firestore';
import { app }          from '../../src/app';
import { createTestUser, clearAuth, clearCollection, now } from '../../../../tests/integration/helpers';

let superAdminToken: string;
let adminToken:      string;
let studentToken:    string;
let studentUid:      string;

async function seedUserDoc(uid: string, roles: string[], email: string) {
  await getFirestore().collection('users').doc(uid).set({
    email, firstName: 'Test', lastName: 'User',
    role: roles[0], roles, status: 'approved',
    profilePhotoUrl: null, preferredLanguage: 'en',
    fcmTokens: [], createdAt: now(), updatedAt: now(), deletedAt: null,
  });
}

beforeAll(async () => {
  await clearAuth();
  const sa      = await createTestUser('super@mgmt.test',   'Test@12345', 'super_admin', ['super_admin']);
  const admin   = await createTestUser('admin@mgmt.test',   'Test@12345', 'admin',       ['admin']);
  const student = await createTestUser('student@mgmt.test', 'Test@12345', 'student',     ['member', 'student']);

  superAdminToken = sa.idToken;
  adminToken      = admin.idToken;
  studentToken    = student.idToken;
  studentUid      = student.uid;

  await seedUserDoc(sa.uid,      ['super_admin'], 'super@mgmt.test');
  await seedUserDoc(admin.uid,   ['admin'],        'admin@mgmt.test');
  await seedUserDoc(student.uid, ['member', 'student'], 'student@mgmt.test');
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('users');
  await clearCollection('outbox');
});

// ─── GET /users/:uid ──────────────────────────────────────────────────────────

describe('GET /users/:uid', () => {

  it('200 — admin gets a user by UID', async () => {
    const res = await request(app)
      .get(`/users/${studentUid}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.uid).toBe(studentUid);
    expect(res.body.email).toBe('student@mgmt.test');
  });

  it('404 — user not found', async () => {
    await request(app)
      .get('/users/no-such-uid')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('403 — student cannot view other users', async () => {
    await request(app)
      .get(`/users/${studentUid}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app).get(`/users/${studentUid}`).expect(401);
  });

});

// ─── POST /users/:uid/suspend ─────────────────────────────────────────────────

describe('POST /users/:uid/suspend', () => {

  it('200 — admin suspends a user', async () => {
    const { uid, idToken: _ } = await createTestUser('tosuspend@mgmt.test', 'Test@12345', 'student', ['member', 'student']);
    await seedUserDoc(uid, ['member', 'student'], 'tosuspend@mgmt.test');

    const res = await request(app)
      .post(`/users/${uid}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.status).toBe('suspended');
  });

  it('404 — user not found', async () => {
    await request(app)
      .post('/users/no-such-uid/suspend')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('403 — student cannot suspend users', async () => {
    await request(app)
      .post(`/users/${studentUid}/suspend`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
  });

});

// ─── POST /users/:uid/reactivate ──────────────────────────────────────────────

describe('POST /users/:uid/reactivate', () => {

  it('200 — admin reactivates a suspended user', async () => {
    const { uid } = await createTestUser('toreactivate@mgmt.test', 'Test@12345', 'student', ['member', 'student']);
    await getFirestore().collection('users').doc(uid).set({
      email: 'toreactivate@mgmt.test', firstName: 'Re', lastName: 'Activate',
      role: 'student', roles: ['member', 'student'], status: 'suspended',
      profilePhotoUrl: null, preferredLanguage: 'en', fcmTokens: [],
      createdAt: now(), updatedAt: now(), deletedAt: null,
    });

    const res = await request(app)
      .post(`/users/${uid}/reactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.status).toBe('approved');
  });

  it('403 — student cannot reactivate users', async () => {
    await request(app)
      .post(`/users/${studentUid}/reactivate`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
  });

});

// ─── POST /me/change-password ─────────────────────────────────────────────────

describe('POST /me/change-password', () => {

  it('204 — student changes their own password', async () => {
    // Use a fresh user so password change doesn't affect other tests
    const { uid, idToken } = await createTestUser('pwchange@mgmt.test', 'Test@12345A!', 'student', ['member', 'student']);
    // ChangePasswordUseCase calls userRepo.findById first — must have a Firestore doc
    await seedUserDoc(uid, ['member', 'student'], 'pwchange@mgmt.test');

    await request(app)
      .post('/me/change-password')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ currentPassword: 'Test@12345A!', newPassword: 'NewPass@99999!' })
      .expect(204);
  });

  it('401 — wrong current password', async () => {
    const res = await request(app)
      .post('/me/change-password')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ currentPassword: 'WrongPassword@1', newPassword: 'NewPass@99999!' })
      .expect(401);

    expect(res.body.error.code).toBe('WRONG_PASSWORD');
  });

  it('400 — new password fails strength validation', async () => {
    const res = await request(app)
      .post('/me/change-password')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ currentPassword: 'Test@12345', newPassword: 'weak' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app)
      .post('/me/change-password')
      .send({ currentPassword: 'Test@12345', newPassword: 'NewPass@99999!' })
      .expect(401);
  });

});

// ─── GET /super-admin/admins ──────────────────────────────────────────────────

describe('GET /super-admin/admins', () => {

  it('200 — super_admin lists all admins', async () => {
    const res = await request(app)
      .get('/super-admin/admins')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(res.body.items).toBeInstanceOf(Array);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it('403 — admin cannot list other admins', async () => {
    await request(app)
      .get('/super-admin/admins')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app).get('/super-admin/admins').expect(401);
  });

});

// ─── GET /super-admin/admins/:uid ─────────────────────────────────────────────

describe('GET /super-admin/admins/:uid', () => {

  it('200 — super_admin gets a specific admin by UID', async () => {
    const list = await request(app)
      .get('/super-admin/admins')
      .set('Authorization', `Bearer ${superAdminToken}`);

    const adminUid = list.body.items[0]?.uid as string | undefined;
    if (!adminUid) return; // skip if no admins seeded

    const res = await request(app)
      .get(`/super-admin/admins/${adminUid}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(res.body.uid).toBe(adminUid);
  });

  it('404 — admin not found', async () => {
    await request(app)
      .get('/super-admin/admins/no-such-uid')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(404);
  });

});

// ─── Super Admin lifecycle: suspend / reactivate / delete ────────────────────

describe('Super Admin — suspend / reactivate / delete admin', () => {

  let createdAdminId: string;

  beforeEach(async () => {
    const res = await request(app)
      .post('/super-admin/admins')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ email: `newadmin-${Date.now()}@mgmt.test`, initialPassword: 'Admin@12345X', firstName: 'New', lastName: 'Admin' });
    createdAdminId = res.body.uid as string;
  });

  it('200 — super_admin suspends an admin', async () => {
    const res = await request(app)
      .post(`/super-admin/admins/${createdAdminId}/suspend`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(res.body.status).toBe('suspended');
  });

  it('200 — super_admin reactivates a suspended admin', async () => {
    await request(app)
      .post(`/super-admin/admins/${createdAdminId}/suspend`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    const res = await request(app)
      .post(`/super-admin/admins/${createdAdminId}/reactivate`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(res.body.status).toBe('approved');
  });

  it('204 — super_admin deletes an admin', async () => {
    await request(app)
      .delete(`/super-admin/admins/${createdAdminId}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(204);
  });

  it('403 — admin cannot suspend other admins', async () => {
    await request(app)
      .post(`/super-admin/admins/${createdAdminId}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
  });

});

// ─── POST /super-admin/users/:uid/make-admin ─────────────────────────────────

describe('POST /super-admin/users/:uid/make-admin', () => {

  it('200 — super_admin promotes a student to admin', async () => {
    const { uid } = await createTestUser('promote@mgmt.test', 'Test@12345', 'student', ['member', 'student']);
    // PromoteToAdminUseCase checks user.role (scalar) === 'student' — seed with student as primary role
    await getFirestore().collection('users').doc(uid).set({
      email: 'promote@mgmt.test', firstName: 'Test', lastName: 'Promote',
      role: 'student', roles: ['member', 'student'], status: 'approved',
      profilePhotoUrl: null, preferredLanguage: 'en', fcmTokens: [],
      createdAt: now(), updatedAt: now(), deletedAt: null,
    });

    const res = await request(app)
      .post(`/super-admin/users/${uid}/make-admin`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    expect(res.body.roles).toContain('admin');
    expect(res.body.roles).toContain('student');
  });

  it('409 INVALID_ROLE — cannot promote a user who is not a student', async () => {
    const { uid } = await createTestUser('member2@mgmt.test', 'Test@12345', 'member', ['member']);
    await seedUserDoc(uid, ['member'], 'member2@mgmt.test');

    const res = await request(app)
      .post(`/super-admin/users/${uid}/make-admin`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(409);

    expect(res.body.error.code).toBe('INVALID_ROLE');
  });

  it('403 — admin cannot promote users to admin', async () => {
    await request(app)
      .post(`/super-admin/users/${studentUid}/make-admin`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
  });

});
