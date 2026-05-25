import request     from 'supertest';
import { app }     from '../../src/app';
import { createTestUser, clearAuth, clearCollection } from '../../../../tests/integration/helpers';

// Mock course-service call for subject count
jest.mock('../../src/infrastructure/clients/CourseServiceClient', () => ({
  CourseServiceClient: jest.fn().mockImplementation(() => ({
    getSubjectCount: jest.fn().mockResolvedValue(3),
  })),
}));

const SUBJECT_ID  = 'subject-1';
const COURSE_ID   = 'course-1';
const SEMESTER_ID = 'semester-1';

let studentToken: string;

beforeAll(async () => {
  await clearAuth();
  const student = await createTestUser('student@progress.test', 'Test@12345', 'student');
  studentToken  = student.idToken;
});

afterEach(async () => {
  await clearCollection('progress');
  await clearCollection('outbox');
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('progress');
  await clearCollection('outbox');
});

describe('POST /progress/subjects/:id/complete', () => {

  it('200 — marks subject complete and sets completedAt', async () => {
    const res = await request(app)
      .post(`/progress/subjects/${SUBJECT_ID}/complete`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId: COURSE_ID, semesterId: SEMESTER_ID })
      .expect(200);

    expect(res.body.state).toBe('completed');
    expect(res.body.completedAt).not.toBeNull();
  });

  it('idempotent — second call returns same completedAt unchanged', async () => {
    const first = await request(app)
      .post(`/progress/subjects/${SUBJECT_ID}/complete`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId: COURSE_ID, semesterId: SEMESTER_ID })
      .expect(200);

    const second = await request(app)
      .post(`/progress/subjects/${SUBJECT_ID}/complete`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId: COURSE_ID, semesterId: SEMESTER_ID })
      .expect(200);

    expect(second.body.completedAt).toBe(first.body.completedAt);
    expect(second.body.state).toBe('completed');
  });

});

describe('GET /me/progress/courses/:courseId', () => {

  it('200 — returns course progress aggregate', async () => {
    await request(app)
      .post(`/progress/subjects/${SUBJECT_ID}/complete`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ courseId: COURSE_ID, semesterId: SEMESTER_ID });

    const res = await request(app)
      .get(`/me/progress/courses/${COURSE_ID}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    expect(res.body.courseId).toBe(COURSE_ID);
    expect(res.body.completionPercent).toBeGreaterThan(0);
    expect(typeof res.body.completionPercent).toBe('number');
  });

});
