import request        from 'supertest';
import { getFirestore } from 'firebase-admin/firestore';
import { app }         from '../../src/app';
import { createTestUser, clearAuth, clearCollection, now } from '../../../../tests/integration/helpers';

// Mock course-service HTTP call — verify course is published
jest.mock('../../src/infrastructure/clients/CourseServiceClient', () => ({
  CourseServiceClient: jest.fn().mockImplementation(() => ({
    isCoursePublished: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock('../../src/infrastructure/clients/UserServiceClient', () => ({
  UserServiceClient: jest.fn().mockImplementation(() => ({
    approveUser: jest.fn().mockResolvedValue(undefined),
  })),
}));

const COURSE_ID = 'test-course-id';
let studentToken: string;
let studentUid:   string;
let adminToken:   string;

beforeAll(async () => {
  await clearAuth();
  const student = await createTestUser('student@enroll.test', 'Test@12345', 'student');
  const admin   = await createTestUser('admin@enroll.test',   'Test@12345', 'admin');
  studentToken = student.idToken;
  studentUid   = student.uid;
  adminToken   = admin.idToken;
});

afterEach(async () => {
  await clearCollection('enrollments');
  await clearCollection('registrations');
  await clearCollection('outbox');
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('enrollments');
  await clearCollection('registrations');
  await clearCollection('outbox');
});

describe('POST /courses/:id/enroll', () => {

  it('201 — student can enroll in a published course', async () => {
    const res = await request(app)
      .post(`/courses/${COURSE_ID}/enroll`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(201);

    expect(res.body.state).toBe('pending');
    expect(res.body.courseId).toBe(COURSE_ID);
    expect(res.body.studentUid).toBe(studentUid);
  });

  it('409 ENROLLMENT_PENDING — cannot enroll twice in same course', async () => {
    await request(app)
      .post(`/courses/${COURSE_ID}/enroll`)
      .set('Authorization', `Bearer ${studentToken}`);

    const res = await request(app)
      .post(`/courses/${COURSE_ID}/enroll`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(409);

    expect(res.body.error.code).toBe('ENROLLMENT_PENDING');
  });

  it('403 — admin cannot enroll in a course', async () => {
    await request(app)
      .post(`/courses/${COURSE_ID}/enroll`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app)
      .post(`/courses/${COURSE_ID}/enroll`)
      .expect(401);
  });

});

describe('GET /me/enrollments', () => {

  it('200 — student gets own enrollments', async () => {
    await request(app)
      .post(`/courses/${COURSE_ID}/enroll`)
      .set('Authorization', `Bearer ${studentToken}`);

    const res = await request(app)
      .get('/me/enrollments')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.items[0].studentUid).toBe(studentUid);
  });

});

describe('POST /admin/registrations/bulk-approve', () => {

  it('returns approved and failed arrays — partial success', async () => {
    // Create two registrations in Firestore
    const db = getFirestore();
    await db.collection('registrations').doc('reg-1').set({
      studentUid: 'uid-1', email: 'a@b.com', firstName: 'A', lastName: 'B',
      state: 'pending', reason: null, createdAt: now(), updatedAt: now(),
    });
    await db.collection('registrations').doc('reg-2').set({
      studentUid: 'uid-2', email: 'c@d.com', firstName: 'C', lastName: 'D',
      state: 'pending', reason: null, createdAt: now(), updatedAt: now(),
    });

    const res = await request(app)
      .post('/admin/registrations/bulk-approve')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ids: ['reg-1', 'reg-2', 'reg-nonexistent'] })
      .expect(200);

    expect(res.body.approved).toBeInstanceOf(Array);
    expect(res.body.failed).toBeInstanceOf(Array);
    // reg-nonexistent should be in failed
    expect(res.body.failed.some((f: { id: string }) => f.id === 'reg-nonexistent')).toBe(true);
  });

});
