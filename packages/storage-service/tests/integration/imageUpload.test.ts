/**
 * Integration tests for POST /subjects/:id/images (V2 — PNG/JPEG subject images)
 */
import request from 'supertest';
import { app } from '../../src/app';
import { createTestUser, clearAuth, clearCollection } from '../../../../tests/integration/helpers';

jest.mock('../../src/infrastructure/repositories/CloudStorageRepository', () => ({
  CloudStorageRepository: jest.fn().mockImplementation(() => ({
    upload:       jest.fn().mockResolvedValue(undefined),
    getSignedUrl: jest.fn().mockResolvedValue('https://signed.example.com/img.png'),
    delete:       jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../src/infrastructure/clients/CourseServiceClient', () => ({
  CourseServiceClient: jest.fn().mockImplementation(() => ({
    getSubject: jest.fn().mockResolvedValue({ id: 'sub-001', courseId: 'course-001' }),
  })),
}));

jest.mock('../../src/infrastructure/clients/EnrollmentServiceClient', () => ({
  EnrollmentServiceClient: jest.fn().mockImplementation(() => ({
    isEnrolled: jest.fn().mockResolvedValue(true),
  })),
}));

const SUBJECT_ID = 'sub-001';
const FAKE_PNG   = Buffer.from('\x89PNG\r\n\x1a\nfake png content');
const FAKE_JPG   = Buffer.from('\xFF\xD8\xFF\xE0fake jpeg content');

let adminToken:   string;
let studentToken: string;

beforeAll(async () => {
  await clearAuth();
  const admin   = await createTestUser('admin@img.test',   'Test@12345', 'admin',   ['admin']);
  const student = await createTestUser('student@img.test', 'Test@12345', 'student', ['member', 'student']);
  adminToken   = admin.idToken;
  studentToken = student.idToken;
});

afterEach(async () => {
  await clearCollection('attachments');
  await clearCollection('outbox');
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('attachments');
  await clearCollection('outbox');
});

describe('POST /subjects/:id/images', () => {

  it('201 — admin uploads a PNG image', async () => {
    const res = await request(app)
      .post(`/subjects/${SUBJECT_ID}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', FAKE_PNG, { filename: 'cover.png', contentType: 'image/png' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.mimeType).toBe('image/png');
    expect(res.body.filename).toBe('cover.png');
    expect(res.body.subjectId).toBe(SUBJECT_ID);
  });

  it('201 — admin uploads a JPEG image', async () => {
    const res = await request(app)
      .post(`/subjects/${SUBJECT_ID}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', FAKE_JPG, { filename: 'photo.jpg', contentType: 'image/jpeg' })
      .expect(201);

    expect(res.body.mimeType).toBe('image/jpeg');
  });

  it('415 — PDF rejected on image endpoint', async () => {
    const fakePdf = Buffer.from('%PDF-1.4 content');
    const res = await request(app)
      .post(`/subjects/${SUBJECT_ID}/images`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', fakePdf, { filename: 'doc.pdf', contentType: 'application/pdf' })
      .expect(415);

    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('404 — subject not found', async () => {
    const { CourseServiceClient } = require('../../src/infrastructure/clients/CourseServiceClient');
    const instance = (CourseServiceClient as jest.Mock).mock.results[0]?.value;
    if (instance) instance.getSubject.mockResolvedValueOnce(null);

    await request(app)
      .post('/subjects/no-such-subject/images')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', FAKE_PNG, { filename: 'cover.png', contentType: 'image/png' })
      .expect(404);
  });

  it('403 — student cannot upload images', async () => {
    await request(app)
      .post(`/subjects/${SUBJECT_ID}/images`)
      .set('Authorization', `Bearer ${studentToken}`)
      .attach('file', FAKE_PNG, { filename: 'cover.png', contentType: 'image/png' })
      .expect(403);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app)
      .post(`/subjects/${SUBJECT_ID}/images`)
      .attach('file', FAKE_PNG, { filename: 'cover.png', contentType: 'image/png' })
      .expect(401);
  });

  it('existing attachment endpoint still rejects PNG (unchanged)', async () => {
    const res = await request(app)
      .post(`/subjects/${SUBJECT_ID}/attachments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', FAKE_PNG, { filename: 'cover.png', contentType: 'image/png' })
      .expect(415);

    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

});
