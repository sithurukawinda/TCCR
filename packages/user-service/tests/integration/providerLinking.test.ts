/**
 * Integration tests for provider linking/unlinking endpoints.
 * Mocks AuthServiceClient — real federated token verification
 * is handled by auth-service internally.
 */
import request          from 'supertest';
import { getFirestore } from 'firebase-admin/firestore';
import { app }          from '../../src/app';
import { createTestUser, clearAuth, clearCollection, now } from '../../../../tests/integration/helpers';

// Mock auth-service client — provider token verification is tested in auth-service
jest.mock('../../src/infrastructure/clients/AuthServiceClient', () => ({
  AuthServiceClient: jest.fn().mockImplementation(() => ({
    verifyFederatedToken: jest.fn(),
  })),
}));

let memberToken: string;
let memberUid:   string;

async function seedUser(uid: string, providers: string[] = ['password']) {
  await getFirestore().collection('users').doc(uid).set({
    email: `user-${uid}@test.com`, firstName: 'Test', lastName: 'User',
    role: 'member', roles: ['member'], status: 'approved',
    profilePhotoUrl: null, preferredLanguage: 'en', fcmTokens: [],
    notificationPreferences: { email: true, push: true },
    providers,
    createdAt: now(), updatedAt: now(), deletedAt: null,
  });
}

beforeAll(async () => {
  await clearAuth();
  const member = await createTestUser('member@provider.test', 'Test@12345', 'member', ['member']);
  memberToken = member.idToken;
  memberUid   = member.uid;
  await seedUser(memberUid, ['password']);
});

afterEach(async () => {
  // Reset providers to ['password'] after each test
  await getFirestore().collection('users').doc(memberUid).update({
    providers: ['password'], updatedAt: now(),
  });
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('users');
});

// ─── POST /me/providers/link ──────────────────────────────────────────────────

describe('POST /me/providers/link', () => {

  it('200 — links google.com provider to account', async () => {
    const { AuthServiceClient } = require('../../src/infrastructure/clients/AuthServiceClient');
    const instance = (AuthServiceClient as jest.Mock).mock.results[0]?.value;
    if (instance) {
      instance.verifyFederatedToken.mockResolvedValueOnce({
        email: `user-${memberUid}@test.com`,
        displayName: 'Test User',
        providerUid: 'google-sub-123',
        providerId: 'google.com',
      });
    }

    const res = await request(app)
      .post('/me/providers/link')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ provider: 'google', idToken: 'mock-google-token' })
      .expect(200);

    expect(res.body.providers).toContain('google.com');
    expect(res.body.providers).toContain('password');

    const doc = await getFirestore().collection('users').doc(memberUid).get();
    expect(doc.data()?.providers).toContain('google.com');
  });

  it('200 — idempotent: linking already-linked provider returns 200', async () => {
    // Pre-seed with google.com already linked
    await getFirestore().collection('users').doc(memberUid).update({
      providers: ['password', 'google.com'],
    });

    const { AuthServiceClient } = require('../../src/infrastructure/clients/AuthServiceClient');
    const instance = (AuthServiceClient as jest.Mock).mock.results[0]?.value;
    if (instance) {
      instance.verifyFederatedToken.mockResolvedValueOnce({
        email: `user-${memberUid}@test.com`,
        displayName: 'Test User',
        providerUid: 'google-sub-123',
        providerId: 'google.com',
      });
    }

    const res = await request(app)
      .post('/me/providers/link')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ provider: 'google', idToken: 'mock-google-token' })
      .expect(200);

    const count = res.body.providers.filter((p: string) => p === 'google.com').length;
    expect(count).toBe(1);
  });

  it('400 — missing idToken', async () => {
    await request(app)
      .post('/me/providers/link')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ provider: 'google' })
      .expect(400);
  });

  it('401 — unauthenticated rejected', async () => {
    await request(app)
      .post('/me/providers/link')
      .send({ provider: 'google', idToken: 'token' })
      .expect(401);
  });

});

// ─── DELETE /me/providers/:provider ──────────────────────────────────────────

describe('DELETE /me/providers/:provider', () => {

  it('200 — unlinks google.com when password also exists', async () => {
    await getFirestore().collection('users').doc(memberUid).update({
      providers: ['password', 'google.com'],
    });

    const res = await request(app)
      .delete('/me/providers/google')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    expect(res.body.providers).not.toContain('google.com');
    expect(res.body.providers).toContain('password');
  });

  it('409 INVALID_STATE — cannot unlink the only provider', async () => {
    // User only has password — try to remove it
    const res = await request(app)
      .delete('/me/providers/google')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(409);

    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  it('400 — invalid provider name', async () => {
    const res = await request(app)
      .delete('/me/providers/facebook')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('401 — unauthenticated rejected', async () => {
    await request(app)
      .delete('/me/providers/google')
      .expect(401);
  });

});
