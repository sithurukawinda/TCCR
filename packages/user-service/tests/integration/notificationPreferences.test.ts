/**
 * Integration tests for:
 *   DELETE /me/fcm-token       — deregister FCM token
 *   PATCH  /me/notifications/preferences — update notification opt-out
 */
import request          from 'supertest';
import { getFirestore } from 'firebase-admin/firestore';
import { app }          from '../../src/app';
import { createTestUser, clearAuth, clearCollection, now } from '../../../../tests/integration/helpers';

let memberToken: string;
let memberUid:   string;

async function seedUser(uid: string, overrides: Record<string, unknown> = {}) {
  await getFirestore().collection('users').doc(uid).set({
    email: `user-${uid}@test.com`, firstName: 'Test', lastName: 'User',
    role: 'member', roles: ['member'], status: 'approved',
    profilePhotoUrl: null, preferredLanguage: 'en',
    fcmTokens: ['token-aaa', 'token-bbb'],
    notificationPreferences: { email: true, push: true },
    createdAt: now(), updatedAt: now(), deletedAt: null,
    ...overrides,
  });
}

beforeAll(async () => {
  await clearAuth();
  const member = await createTestUser('member@notif.test', 'Test@12345', 'member', ['member']);
  memberToken = member.idToken;
  memberUid   = member.uid;
  await seedUser(memberUid);
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('users');
});

// ─── DELETE /me/fcm-token ─────────────────────────────────────────────────────

describe('DELETE /me/fcm-token', () => {

  beforeEach(async () => {
    // Reset tokens before each test
    await getFirestore().collection('users').doc(memberUid).update({
      fcmTokens: ['token-aaa', 'token-bbb'],
    });
  });

  it('204 — removes the specified FCM token', async () => {
    await request(app)
      .delete('/me/fcm-token')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ token: 'token-aaa' })
      .expect(204);

    const doc = await getFirestore().collection('users').doc(memberUid).get();
    expect(doc.data()?.fcmTokens).not.toContain('token-aaa');
    expect(doc.data()?.fcmTokens).toContain('token-bbb');
  });

  it('204 — idempotent: removing a non-existent token returns 204', async () => {
    await request(app)
      .delete('/me/fcm-token')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ token: 'token-not-registered' })
      .expect(204);
  });

  it('400 — missing token field', async () => {
    await request(app)
      .delete('/me/fcm-token')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({})
      .expect(400);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app)
      .delete('/me/fcm-token')
      .send({ token: 'token-aaa' })
      .expect(401);
  });

});

// ─── PATCH /me/notifications/preferences ─────────────────────────────────────

describe('PATCH /me/notifications/preferences', () => {

  beforeEach(async () => {
    // Reset preferences before each test
    await getFirestore().collection('users').doc(memberUid).update({
      notificationPreferences: { email: true, push: true },
    });
  });

  it('200 — disables push notifications', async () => {
    const res = await request(app)
      .patch('/me/notifications/preferences')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ push: false })
      .expect(200);

    expect(res.body.push).toBe(false);
    expect(res.body.email).toBe(true);

    const doc = await getFirestore().collection('users').doc(memberUid).get();
    expect(doc.data()?.notificationPreferences.push).toBe(false);
    expect(doc.data()?.notificationPreferences.email).toBe(true);
  });

  it('200 — disables email notifications', async () => {
    const res = await request(app)
      .patch('/me/notifications/preferences')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ email: false })
      .expect(200);

    expect(res.body.email).toBe(false);
    expect(res.body.push).toBe(true);
  });

  it('200 — disables both channels at once', async () => {
    const res = await request(app)
      .patch('/me/notifications/preferences')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ email: false, push: false })
      .expect(200);

    expect(res.body).toEqual({ email: false, push: false });
  });

  it('200 — re-enables a disabled channel', async () => {
    await getFirestore().collection('users').doc(memberUid).update({
      notificationPreferences: { email: false, push: false },
    });

    const res = await request(app)
      .patch('/me/notifications/preferences')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ email: true })
      .expect(200);

    expect(res.body.email).toBe(true);
    expect(res.body.push).toBe(false);
  });

  it('400 — body with no fields rejected', async () => {
    await request(app)
      .patch('/me/notifications/preferences')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({})
      .expect(400);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app)
      .patch('/me/notifications/preferences')
      .send({ push: false })
      .expect(401);
  });

});
