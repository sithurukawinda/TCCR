/**
 * Integration tests for Storage Service attachment endpoints
 * Mocks CloudStorageRepository (Firebase Storage) and cross-service clients
 * so tests run against Firestore emulator only.
 */
import request from 'supertest';
import { app } from '../../src/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createTestUser, clearAuth, clearCollection, now } from '../../../../tests/integration/helpers';

// Mock Firebase Cloud Storage — avoids needing a real Storage bucket
jest.mock('../../src/infrastructure/repositories/CloudStorageRepository', () => ({
  CloudStorageRepository: jest.fn().mockImplementation(() => ({
    upload:     jest.fn().mockResolvedValue(undefined),
    getSignedUrl: jest.fn().mockResolvedValue('https://signed-url.example.com/file.pdf?X-Goog-Signature=abc'),
    delete:     jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock CourseServiceClient — subject lookup
jest.mock('../../src/infrastructure/clients/CourseServiceClient', () => ({
  CourseServiceClient: jest.fn().mockImplementation(() => ({
    getSubject: jest.fn().mockResolvedValue({ id: 'sub-001', courseId: 'course-001' }),
  })),
}));

// Mock EnrollmentServiceClient — enrollment check for download
jest.mock('../../src/infrastructure/clients/EnrollmentServiceClient', () => ({
  EnrollmentServiceClient: jest.fn().mockImplementation(() => ({
    isEnrolled: jest.fn().mockResolvedValue(true),
  })),
}));

const SUBJECT_ID = 'sub-001';
const FAKE_PDF   = Buffer.from('%PDF-1.4 fake pdf content');

let adminToken:   string;
let studentToken: string;

beforeAll(async () => {
  await clearAuth();
  const admin   = await createTestUser('admin@attach.test',   'Test@12345', 'admin',   ['admin']);
  const student = await createTestUser('student@attach.test', 'Test@12345', 'student', ['member', 'student']);
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

// ─── POST /subjects/:id/attachments ──────────────────────────────────────────

describe('POST /subjects/:id/attachments', () => {

  it('201 — admin uploads a PDF attachment', async () => {
    const res = await request(app)
      .post(`/subjects/${SUBJECT_ID}/attachments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', FAKE_PDF, { filename: 'study-notes.pdf', contentType: 'application/pdf' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.filename).toBe('study-notes.pdf');
    expect(res.body.mimeType).toBe('application/pdf');
    expect(res.body.subjectId).toBe(SUBJECT_ID);
    expect(res.body.courseId).toBe('course-001');
  });

  it('415 — unsupported file type rejected', async () => {
    const fakeJpg = Buffer.from('fake jpeg bytes');
    const res = await request(app)
      .post(`/subjects/${SUBJECT_ID}/attachments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', fakeJpg, { filename: 'image.jpg', contentType: 'image/jpeg' })
      .expect(415);

    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('403 — student cannot upload attachments', async () => {
    await request(app)
      .post(`/subjects/${SUBJECT_ID}/attachments`)
      .set('Authorization', `Bearer ${studentToken}`)
      .attach('file', FAKE_PDF, { filename: 'study.pdf', contentType: 'application/pdf' })
      .expect(403);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app)
      .post(`/subjects/${SUBJECT_ID}/attachments`)
      .attach('file', FAKE_PDF, { filename: 'study.pdf', contentType: 'application/pdf' })
      .expect(401);
  });

  it('404 — subject not found (CourseServiceClient returns null)', async () => {
    const { CourseServiceClient } = require('../../src/infrastructure/clients/CourseServiceClient');
    const instance = (CourseServiceClient as jest.Mock).mock.results[0]?.value;
    if (instance) instance.getSubject.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/subjects/no-such-subject/attachments')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', FAKE_PDF, { filename: 'study.pdf', contentType: 'application/pdf' })
      .expect(404);

    expect(res.body.error.code).toBe('SUBJECT_NOT_FOUND');
  });

});

// ─── GET /attachments/:id/download-url ───────────────────────────────────────

describe('GET /attachments/:id/download-url', () => {

  it('200 — enrolled student gets a signed download URL', async () => {
    // Seed an attachment record directly in Firestore
    const db = getFirestore();
    await db.collection('attachments').doc('att-001').set({
      id: 'att-001', subjectId: SUBJECT_ID, courseId: 'course-001',
      filename: 'study-notes.pdf', mimeType: 'application/pdf',
      sizeBytes: 1024, storagePath: 'attachments/sub-001/att-001.pdf',
      createdAt: now(),
    });

    const res = await request(app)
      .get('/attachments/att-001/download-url')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    expect(res.body.downloadUrl).toContain('signed-url.example.com');
    expect(res.body.expiresAt).toBeDefined();
  });

  it('200 — admin gets signed URL without enrollment check', async () => {
    const db = getFirestore();
    await db.collection('attachments').doc('att-002').set({
      id: 'att-002', subjectId: SUBJECT_ID, courseId: 'course-001',
      filename: 'notes.pdf', mimeType: 'application/pdf',
      sizeBytes: 512, storagePath: 'attachments/sub-001/att-002.pdf',
      createdAt: now(),
    });

    const res = await request(app)
      .get('/attachments/att-002/download-url')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.downloadUrl).toBeDefined();
  });

  it('404 — attachment not found', async () => {
    await request(app)
      .get('/attachments/no-such-att/download-url')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(404);
  });

  it('403 — non-enrolled student cannot download', async () => {
    const { EnrollmentServiceClient } = require('../../src/infrastructure/clients/EnrollmentServiceClient');
    const instance = (EnrollmentServiceClient as jest.Mock).mock.results[0]?.value;
    if (instance) instance.isEnrolled.mockResolvedValueOnce(false);

    const db = getFirestore();
    await db.collection('attachments').doc('att-003').set({
      id: 'att-003', subjectId: SUBJECT_ID, courseId: 'course-001',
      filename: 'locked.pdf', mimeType: 'application/pdf',
      sizeBytes: 256, storagePath: 'attachments/sub-001/att-003.pdf',
      createdAt: now(),
    });

    await request(app)
      .get('/attachments/att-003/download-url')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app).get('/attachments/att-001/download-url').expect(401);
  });

});

// ─── DELETE /attachments/:id ──────────────────────────────────────────────────

describe('DELETE /attachments/:id', () => {

  it('204 — admin deletes an attachment', async () => {
    // Upload first to get a real attachment record
    const uploadRes = await request(app)
      .post(`/subjects/${SUBJECT_ID}/attachments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', FAKE_PDF, { filename: 'delete-me.pdf', contentType: 'application/pdf' });

    const attId = uploadRes.body.id as string;

    await request(app)
      .delete(`/attachments/${attId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    // Verify deleted — download URL now 404
    await request(app)
      .get(`/attachments/${attId}/download-url`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(404);
  });

  it('404 — deleting a non-existent attachment', async () => {
    await request(app)
      .delete('/attachments/no-such-att')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('403 — student cannot delete an attachment', async () => {
    const db = getFirestore();
    await db.collection('attachments').doc('att-prot').set({
      id: 'att-prot', subjectId: SUBJECT_ID, courseId: 'course-001',
      filename: 'protected.pdf', mimeType: 'application/pdf',
      sizeBytes: 256, storagePath: 'attachments/sub-001/att-prot.pdf',
      createdAt: now(),
    });

    await request(app)
      .delete('/attachments/att-prot')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app).delete('/attachments/att-001').expect(401);
  });

});
