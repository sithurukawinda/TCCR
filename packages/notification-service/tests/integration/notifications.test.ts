import request        from 'supertest';
import { getFirestore } from 'firebase-admin/firestore';
import { app }         from '../../src/app';
import { createTestUser, clearAuth, clearCollection, now } from '../../../../tests/integration/helpers';

jest.mock('../../src/infrastructure/clients/UserServiceClient', () => ({
  UserServiceClient: jest.fn().mockImplementation(() => ({
    getAdminUids: jest.fn().mockResolvedValue([]),
  })),
}));

let studentToken: string;
let studentUid:   string;

beforeAll(async () => {
  await clearAuth();
  const student = await createTestUser('student@notif.test', 'Test@12345', 'student');
  studentToken  = student.idToken;
  studentUid    = student.uid;
});

beforeEach(async () => {
  await clearCollection('notifications');
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('notifications');
});

async function seedNotification(read = false): Promise<string> {
  const ref = getFirestore().collection('notifications').doc();
  await ref.set({
    userUid: studentUid, type: 'test', title: 'T', body: 'B',
    read, createdAt: now(),
  });
  return ref.id;
}

describe('GET /me/notifications', () => {

  it('200 — returns paginated notifications for the user', async () => {
    await seedNotification(false);
    await seedNotification(true);

    const res = await request(app)
      .get('/me/notifications')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    expect(res.body.items.length).toBe(2);
    expect(res.body.items.every((n: { userUid: string }) => n.userUid === studentUid)).toBe(true);
  });

  it('200 — can filter by read=false', async () => {
    await seedNotification(false);
    await seedNotification(true);

    const res = await request(app)
      .get('/me/notifications?read=false')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    expect(res.body.items.every((n: { read: boolean }) => n.read === false)).toBe(true);
  });

});

describe('POST /me/notifications/:id/read', () => {

  it('200 — marks a single notification as read', async () => {
    const id = await seedNotification(false);

    const res = await request(app)
      .post(`/me/notifications/${id}/read`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    expect(res.body.read).toBe(true);
  });

});

describe('POST /me/notifications/read-all', () => {

  it('204 — marks all notifications as read', async () => {
    await seedNotification(false);
    await seedNotification(false);

    await request(app)
      .post('/me/notifications/read-all')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(204);

    // Verify Firestore state
    const snap = await getFirestore().collection('notifications')
      .where('userUid', '==', studentUid)
      .where('read', '==', false)
      .get();
    expect(snap.empty).toBe(true);
  });

});
