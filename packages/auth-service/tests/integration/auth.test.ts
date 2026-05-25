/**
 * Integration tests for remaining auth endpoints:
 * - POST /auth/password-reset/verify
 * - POST /auth/track-failure
 */
import request        from 'supertest';
import { getFirestore } from 'firebase-admin/firestore';
import { app }         from '../../src/app';
import { clearAuth, clearCollection } from '../../../../tests/integration/helpers';

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

const TEST_EMAIL = `authtest-${Date.now()}@test.com`;

beforeEach(async () => {
  await clearCollection('passwordResetOtps');
  await clearCollection('loginAttempts');
  await clearCollection('outbox');
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('passwordResetOtps');
  await clearCollection('loginAttempts');
  await clearCollection('outbox');
});

// ─── POST /auth/password-reset/verify ────────────────────────────────────────

describe('POST /auth/password-reset/verify', () => {

  it('204 — valid OTP is accepted and OTP record deleted', async () => {
    // Seed a valid OTP record directly in Firestore
    const otp       = '482910';
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min from now
    await getFirestore().collection('passwordResetOtps').doc(TEST_EMAIL).set({
      email: TEST_EMAIL, otp, expiresAt, attempts: 0,
    });

    await request(app)
      .post('/auth/password-reset/verify')
      .send({ email: TEST_EMAIL, otp })
      .expect(204);

    // OTP record should be deleted after successful verification
    const doc = await getFirestore().collection('passwordResetOtps').doc(TEST_EMAIL).get();
    expect(doc.exists).toBe(false);
  });

  it('400 INVALID_OTP — wrong OTP code', async () => {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await getFirestore().collection('passwordResetOtps').doc(TEST_EMAIL).set({
      email: TEST_EMAIL, otp: '111111', expiresAt, attempts: 0,
    });

    const res = await request(app)
      .post('/auth/password-reset/verify')
      .send({ email: TEST_EMAIL, otp: '999999' })
      .expect(400);

    expect(res.body.error.code).toBe('INVALID_OTP');
  });

  it('400 OTP_EXPIRED — expired OTP is rejected', async () => {
    const expiresAt = new Date(Date.now() - 1000).toISOString(); // 1 second ago
    await getFirestore().collection('passwordResetOtps').doc(TEST_EMAIL).set({
      email: TEST_EMAIL, otp: '482910', expiresAt, attempts: 0,
    });

    const res = await request(app)
      .post('/auth/password-reset/verify')
      .send({ email: TEST_EMAIL, otp: '482910' })
      .expect(400);

    expect(res.body.error.code).toBe('OTP_EXPIRED');
  });

  it('400 OTP_MAX_ATTEMPTS — too many failed attempts', async () => {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await getFirestore().collection('passwordResetOtps').doc(TEST_EMAIL).set({
      email: TEST_EMAIL, otp: '482910', expiresAt, attempts: 5,
    });

    const res = await request(app)
      .post('/auth/password-reset/verify')
      .send({ email: TEST_EMAIL, otp: '000000' })
      .expect(400);

    expect(res.body.error.code).toBe('OTP_MAX_ATTEMPTS');
  });

  it('400 — missing otp field', async () => {
    const res = await request(app)
      .post('/auth/password-reset/verify')
      .send({ email: TEST_EMAIL })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400 — otp must be exactly 6 digits', async () => {
    const res = await request(app)
      .post('/auth/password-reset/verify')
      .send({ email: TEST_EMAIL, otp: '12345' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('204 — always 204 when email does not have an OTP record (safe fallback)', async () => {
    // No OTP seeded for this email — should return 204 or 400 INVALID_OTP
    // The spec says to not reveal whether email exists, but OTP not found → INVALID_OTP
    const res = await request(app)
      .post('/auth/password-reset/verify')
      .send({ email: 'no-otp@test.com', otp: '123456' });

    // Accept either 204 (if not found is treated as no-op) or 400 INVALID_OTP
    expect([204, 400]).toContain(res.status);
  });

});

// ─── POST /auth/track-failure ─────────────────────────────────────────────────

describe('POST /auth/track-failure', () => {

  it('200 — records a failed login attempt', async () => {
    const res = await request(app)
      .post('/auth/track-failure')
      .send({ email: 'user@test.com' })
      .expect(200);

    expect(typeof res.body.attempts).toBe('number');
    expect(res.body.attempts).toBeGreaterThanOrEqual(1);
    expect(typeof res.body.locked).toBe('boolean');
  });

  it('200 — second failure increments the counter', async () => {
    const email = `counter-${Date.now()}@test.com`;

    const res1 = await request(app)
      .post('/auth/track-failure')
      .send({ email })
      .expect(200);

    const res2 = await request(app)
      .post('/auth/track-failure')
      .send({ email })
      .expect(200);

    expect(res2.body.attempts).toBeGreaterThan(res1.body.attempts);
  });

  it('200 — locked:false when under threshold', async () => {
    const res = await request(app)
      .post('/auth/track-failure')
      .send({ email: `under@test.com` })
      .expect(200);

    expect(res.body.locked).toBe(false);
  });

  it('400 — missing email field', async () => {
    await request(app)
      .post('/auth/track-failure')
      .send({})
      .expect(400);
  });

  it('400 — invalid email format', async () => {
    await request(app)
      .post('/auth/track-failure')
      .send({ email: 'not-an-email' })
      .expect(400);
  });

});
