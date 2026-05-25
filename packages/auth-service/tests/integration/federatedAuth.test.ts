/**
 * Integration tests for federated auth endpoints.
 * Mocks GoogleAuthClient and AppleAuthClient — real Google/Apple tokens
 * are not available in the emulator environment.
 */
import request          from 'supertest';
import { getFirestore } from 'firebase-admin/firestore';
import { app }          from '../../src/app';
import { clearAuth, clearCollection } from '../../../../tests/integration/helpers';

// Mock federated auth clients — we cannot obtain real Google/Apple tokens in tests
jest.mock('../../src/infrastructure/clients/GoogleAuthClient', () => ({
  GoogleAuthClient: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      email:     'testuser@gmail.com',
      name:      'Test User',
      googleUid: 'google-sub-123',
    }),
  })),
}));

jest.mock('../../src/infrastructure/clients/AppleAuthClient', () => ({
  AppleAuthClient: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      email:    'testuser@icloud.com',
      appleUid: 'apple-sub-456',
    }),
  })),
}));

// Mock inter-service clients
jest.mock('../../src/infrastructure/clients/UserServiceClient', () => ({
  UserServiceClient: jest.fn().mockImplementation(() => ({
    emailExists: jest.fn().mockResolvedValue(false),
  })),
}));

jest.mock('../../src/infrastructure/clients/EnrollmentServiceClient', () => ({
  EnrollmentServiceClient: jest.fn().mockImplementation(() => ({
    createRegistration: jest.fn().mockResolvedValue(undefined),
  })),
}));

beforeAll(async () => {
  await clearAuth();
});

afterEach(async () => {
  await clearAuth();
  await clearCollection('users');
  await clearCollection('outbox');
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('users');
  await clearCollection('outbox');
});

// ─── POST /auth/federated/google ──────────────────────────────────────────────

describe('POST /auth/federated/google', () => {

  it('200 — new Google user: creates member and returns firebaseToken', async () => {
    const res = await request(app)
      .post('/auth/federated/google')
      .send({ idToken: 'mock-google-token', preferredLanguage: 'en' })
      .expect(200);

    expect(res.body.firebaseToken).toBeDefined();
    expect(res.body.uid).toBeDefined();
    expect(res.body.isNewUser).toBe(true);

    // Verify Firestore doc created with member role
    const doc = await getFirestore().collection('users').doc(res.body.uid).get();
    expect(doc.exists).toBe(true);
    expect(doc.data()?.role).toBe('member');
    expect(doc.data()?.roles).toContain('member');
    expect(doc.data()?.status).toBe('approved');
    expect(doc.data()?.providers).toContain('google.com');
  });

  it('200 — returning Google user: returns isNewUser=false, no new Firestore doc', async () => {
    // First sign-in creates the user
    const first = await request(app)
      .post('/auth/federated/google')
      .send({ idToken: 'mock-google-token', preferredLanguage: 'en' });

    const firstUid = first.body.uid as string;

    // Second sign-in finds existing user
    const second = await request(app)
      .post('/auth/federated/google')
      .send({ idToken: 'mock-google-token', preferredLanguage: 'en' })
      .expect(200);

    expect(second.body.isNewUser).toBe(false);
    expect(second.body.uid).toBe(firstUid);
  });

  it('400 — missing idToken', async () => {
    const res = await request(app)
      .post('/auth/federated/google')
      .send({ preferredLanguage: 'en' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400 — unknown provider returns 400', async () => {
    const res = await request(app)
      .post('/auth/federated/facebook')
      .send({ idToken: 'some-token' });

    expect(res.status).toBe(400);
  });

  it('400 — idToken must not be empty string', async () => {
    await request(app)
      .post('/auth/federated/google')
      .send({ idToken: '', preferredLanguage: 'en' })
      .expect(400);
  });

});

// ─── POST /auth/federated/apple ───────────────────────────────────────────────

describe('POST /auth/federated/apple', () => {

  it('200 — new Apple user: creates member and returns firebaseToken', async () => {
    const res = await request(app)
      .post('/auth/federated/apple')
      .send({ idToken: 'mock-apple-token', preferredLanguage: 'si' })
      .expect(200);

    expect(res.body.firebaseToken).toBeDefined();
    expect(res.body.isNewUser).toBe(true);

    const doc = await getFirestore().collection('users').doc(res.body.uid).get();
    expect(doc.data()?.providers).toContain('apple.com');
    expect(doc.data()?.preferredLanguage).toBe('si');
  });

  it('400 — missing idToken', async () => {
    await request(app)
      .post('/auth/federated/apple')
      .send({})
      .expect(400);
  });

});

// ─── POST /internal/auth/verify-token ────────────────────────────────────────

describe('POST /internal/auth/verify-token', () => {

  it('200 — verifies Google token and returns payload', async () => {
    const res = await request(app)
      .post('/internal/auth/verify-token')
      .set('x-internal-service-key', 'test-secret')
      .send({ provider: 'google', idToken: 'mock-google-token' })
      .expect(200);

    expect(res.body.email).toBe('testuser@gmail.com');
    expect(res.body.providerId).toBe('google.com');
  });

  it('200 — verifies Apple token and returns payload', async () => {
    const res = await request(app)
      .post('/internal/auth/verify-token')
      .set('x-internal-service-key', 'test-secret')
      .send({ provider: 'apple', idToken: 'mock-apple-token' })
      .expect(200);

    expect(res.body.email).toBe('testuser@icloud.com');
    expect(res.body.providerId).toBe('apple.com');
  });

  it('401 — missing internal service key', async () => {
    await request(app)
      .post('/internal/auth/verify-token')
      .send({ provider: 'google', idToken: 'token' })
      .expect(401);
  });

  it('400 — invalid provider', async () => {
    await request(app)
      .post('/internal/auth/verify-token')
      .set('x-internal-service-key', 'test-secret')
      .send({ provider: 'facebook', idToken: 'token' })
      .expect(400);
  });

});
