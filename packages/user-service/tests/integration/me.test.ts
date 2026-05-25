import request        from 'supertest';
import { getFirestore } from 'firebase-admin/firestore';
import { app }         from '../../src/app';
import { createTestUser, clearAuth, clearCollection, now } from '../../../../tests/integration/helpers';

beforeAll(async () => {
  await clearAuth();
  await clearCollection('users');
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('users');
});

describe('GET /me', () => {

  it('200 — returns own profile for authenticated student', async () => {
    const { uid, idToken } = await createTestUser('me@test.com', 'Test@12345', 'student');

    // Seed Firestore user doc
    await getFirestore().collection('users').doc(uid).set({
      email: 'me@test.com', firstName: 'Test', lastName: 'User',
      role: 'student', status: 'approved', profilePhotoUrl: null,
      createdAt: now(), updatedAt: now(), deletedAt: null,
    });

    const res = await request(app)
      .get('/me')
      .set('Authorization', `Bearer ${idToken}`)
      .expect(200);

    expect(res.body.email).toBe('me@test.com');
    expect(res.body.role).toBe('student');
  });

  it('401 — rejects request without token', async () => {
    await request(app).get('/me').expect(401);
  });

});

describe('PATCH /me', () => {

  it('200 — updates own profile fields', async () => {
    const { uid, idToken } = await createTestUser('patch@test.com', 'Test@12345', 'student');

    await getFirestore().collection('users').doc(uid).set({
      email: 'patch@test.com', firstName: 'Old', lastName: 'Name',
      role: 'student', status: 'approved', profilePhotoUrl: null,
      createdAt: now(), updatedAt: now(), deletedAt: null,
    });

    const res = await request(app)
      .patch('/me')
      .set('Authorization', `Bearer ${idToken}`)
      .send({ firstName: 'New' })
      .expect(200);

    expect(res.body.firstName).toBe('New');
    expect(res.body.lastName).toBe('Name'); // unchanged
  });

});
