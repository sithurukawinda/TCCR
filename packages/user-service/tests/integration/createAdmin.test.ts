import request        from 'supertest';
import { getFirestore } from 'firebase-admin/firestore';
import { app }         from '../../src/app';
import { createTestUser, clearAuth, clearCollection, now } from '../../../../tests/integration/helpers';

let superAdminToken: string;
let adminToken:      string;

beforeAll(async () => {
  await clearAuth();
  await clearCollection('users');

  const sa = await createTestUser('superadmin@test.com', 'Test@12345', 'super_admin');
  superAdminToken = sa.idToken;
  await getFirestore().collection('users').doc(sa.uid).set({
    email: 'superadmin@test.com', firstName: 'Super', lastName: 'Admin',
    role: 'super_admin', status: 'approved', profilePhotoUrl: null,
    createdAt: now(), updatedAt: now(), deletedAt: null,
  });

  const adm = await createTestUser('admin@test.com', 'Test@12345', 'admin');
  adminToken = adm.idToken;
  await getFirestore().collection('users').doc(adm.uid).set({
    email: 'admin@test.com', firstName: 'Admin', lastName: 'User',
    role: 'admin', status: 'approved', profilePhotoUrl: null,
    createdAt: now(), updatedAt: now(), deletedAt: null,
  });
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('users');
});

describe('POST /super-admin/admins', () => {

  it('201 — super_admin creates a new admin account', async () => {
    const res = await request(app)
      .post('/super-admin/admins')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        firstName: 'Kavinda', lastName: 'P',
        email:     `newadmin-${Date.now()}@test.com`,
        initialPassword: 'Admin@Secure2026',
      })
      .expect(201);

    expect(res.body.role).toBe('admin');
    expect(res.body.status).toBe('approved');
  });

  it('403 — admin cannot create admin accounts', async () => {
    await request(app)
      .post('/super-admin/admins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'X', lastName: 'Y', email: 'x@y.com', initialPassword: 'Admin@Secure2026' })
      .expect(403);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app)
      .post('/super-admin/admins')
      .send({ firstName: 'X', lastName: 'Y', email: 'x@y.com', initialPassword: 'Admin@Secure2026' })
      .expect(401);
  });

});

describe('GET /users', () => {

  it('200 — admin gets paginated user list', async () => {
    const res = await request(app)
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body).toMatchObject({ items: expect.any(Array), total: expect.any(Number) });
  });

  it('403 — student cannot list users', async () => {
    const { idToken } = await createTestUser('student@test.com', 'Test@12345', 'student');
    await request(app)
      .get('/users')
      .set('Authorization', `Bearer ${idToken}`)
      .expect(403);
  });

});
