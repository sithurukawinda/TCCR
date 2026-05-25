import request          from 'supertest';
import { getFirestore } from 'firebase-admin/firestore';
import { app }          from '../../src/app';
import { clearCollection, clearAuth } from '../../../../tests/integration/helpers';

// Mock inter-service HTTP calls so registration doesn't depend on running services
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

const VALID_BODY = {
  firstName: 'Viruli',
  lastName:  'W',
  email:     `reg-${Date.now()}@test.com`,
  password:  'SecurePass@2026',
};

beforeEach(async () => {
  await clearAuth();
  await clearCollection('users');
  await clearCollection('outbox');
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('users');
  await clearCollection('outbox');
});

describe('POST /auth/register', () => {

  it('201 — V2: creates active Member immediately (no approval queue)', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send(VALID_BODY)
      .expect(201);

    // V2 response message
    expect(res.body.message).toBeDefined();

    // Verify Firestore document: V2 creates member with status=approved
    const docs = await getFirestore().collection('users')
      .where('email', '==', VALID_BODY.email)
      .get();
    expect(docs.empty).toBe(false);
    expect(docs.docs[0].data().status).toBe('approved');
    expect(docs.docs[0].data().role).toBe('member');
    expect(docs.docs[0].data().roles).toContain('member');
  });

  it('400 — returns VALIDATION_ERROR for weak password', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...VALID_BODY, password: 'weak' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400 — returns VALIDATION_ERROR for missing required fields', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'a@b.com' })
      .expect(400);
  });

  it('409 — EMAIL_EXISTS when user-service reports email taken', async () => {
    const { UserServiceClient } = require('../../src/infrastructure/clients/UserServiceClient');
    const instance = (UserServiceClient as jest.Mock).mock.results[0]?.value;
    if (instance) instance.emailExists.mockResolvedValueOnce(true);

    const res = await request(app)
      .post('/auth/register')
      .send({ ...VALID_BODY, email: `dup-${Date.now()}@test.com` })
      .expect(409);

    expect(res.body.error.code).toBe('EMAIL_EXISTS');
  });

});
