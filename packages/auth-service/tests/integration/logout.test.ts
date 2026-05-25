import request     from 'supertest';
import { app }     from '../../src/app';
import { createTestUser, clearAuth, clearCollection } from '../../../../tests/integration/helpers';

jest.mock('../../src/infrastructure/clients/UserServiceClient', () => ({
  UserServiceClient: jest.fn().mockImplementation(() => ({
    emailExists: jest.fn().mockResolvedValue(false),
  })),
}));

beforeEach(async () => {
  await clearAuth();
  await clearCollection('outbox');
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('outbox');
});

describe('POST /auth/logout', () => {

  it('204 — revokes tokens for authenticated user', async () => {
    const { idToken } = await createTestUser('logout@test.com', 'Test@12345', 'student');

    await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${idToken}`)
      .expect(204);
  });

  it('401 — rejects request without token', async () => {
    await request(app)
      .post('/auth/logout')
      .expect(401);
  });

});

describe('POST /auth/password-reset', () => {

  it('204 — always returns 204 regardless of email existence', async () => {
    await request(app)
      .post('/auth/password-reset')
      .send({ email: 'nonexistent@test.com' })
      .expect(204);
  });

  it('400 — returns error for invalid email format', async () => {
    await request(app)
      .post('/auth/password-reset')
      .send({ email: 'not-an-email' })
      .expect(400);
  });

});
