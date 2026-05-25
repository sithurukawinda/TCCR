/**
 * Integration tests for POST /me/avatar
 * Firebase Storage is mocked (same pattern as storage-service integration tests)
 * so this suite only needs the Firestore + Auth emulators.
 */
import request from 'supertest';
import { getFirestore } from 'firebase-admin/firestore';
import { app } from '../../src/app';
import { createTestUser, clearAuth, clearCollection, now } from '../../../../tests/integration/helpers';

// Mock Firebase Storage — avoids needing a real Storage bucket or emulator
jest.mock('firebase-admin/storage', () => ({
  getStorage: jest.fn(() => ({
    bucket: jest.fn(() => ({
      file: jest.fn(() => ({
        save:       jest.fn().mockResolvedValue(undefined),
        makePublic: jest.fn().mockResolvedValue(undefined),
      })),
    })),
  })),
}));

// Minimal 1×1 white PNG (67 bytes — valid PNG header, passes MIME check)
const TINY_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
  0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc,
  0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
  0x44, 0xae, 0x42, 0x60, 0x82,
]);

// Minimal 1×1 JPEG
const TINY_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
  0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

let memberToken: string;
let memberUid:   string;
let adminToken:  string;
let adminUid:    string;

async function seedUserDoc(uid: string, email: string, role: string, roles: string[]) {
  await getFirestore().collection('users').doc(uid).set({
    email, firstName: 'Test', lastName: 'User',
    role, roles, status: 'approved',
    profilePhotoUrl: null, preferredLanguage: 'en',
    providers: ['password'], fcmTokens: [],
    notificationPreferences: { email: true, push: true },
    createdAt: now(), updatedAt: now(), deletedAt: null,
  });
}

beforeAll(async () => {
  await clearAuth();
  await clearCollection('users');

  const member = await createTestUser('member@avatar.test', 'Test@12345', 'member', ['member']);
  const admin  = await createTestUser('admin@avatar.test',  'Test@12345', 'admin',  ['admin']);
  memberToken = member.idToken;
  memberUid   = member.uid;
  adminToken  = admin.idToken;
  adminUid    = admin.uid;

  // UploadAvatarUseCase calls userRepo.findById — Firestore user doc must exist
  await seedUserDoc(memberUid, 'member@avatar.test', 'member', ['member']);
  await seedUserDoc(adminUid,  'admin@avatar.test',  'admin',  ['admin']);
});

afterAll(async () => {
  await clearAuth();
  await clearCollection('users');
});

// ─── POST /me/avatar ──────────────────────────────────────────────────────────

describe('POST /me/avatar', () => {

  it('200 — uploads a PNG and returns profilePhotoUrl', async () => {
    const res = await request(app)
      .post('/me/avatar')
      .set('Authorization', `Bearer ${memberToken}`)
      .attach('photo', TINY_PNG, { filename: 'avatar.png', contentType: 'image/png' })
      .expect(200);

    expect(res.body.profilePhotoUrl).toBeDefined();
    expect(typeof res.body.profilePhotoUrl).toBe('string');
    expect(res.body.profilePhotoUrl.length).toBeGreaterThan(0);
  });

  it('200 — uploads a JPEG and returns profilePhotoUrl', async () => {
    const res = await request(app)
      .post('/me/avatar')
      .set('Authorization', `Bearer ${memberToken}`)
      .attach('photo', TINY_JPEG, { filename: 'avatar.jpg', contentType: 'image/jpeg' })
      .expect(200);

    expect(res.body.profilePhotoUrl).toBeDefined();
  });

  it('200 — admin can also upload an avatar', async () => {
    const res = await request(app)
      .post('/me/avatar')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('photo', TINY_PNG, { filename: 'avatar.png', contentType: 'image/png' })
      .expect(200);

    expect(res.body.profilePhotoUrl).toBeDefined();
  });

  it('415 — rejects a non-image file (PDF)', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.4 fake pdf content');
    await request(app)
      .post('/me/avatar')
      .set('Authorization', `Bearer ${memberToken}`)
      .attach('photo', pdfBuffer, { filename: 'file.pdf', contentType: 'application/pdf' })
      .expect(415);
  });

  it('400 — rejects request with no file attached', async () => {
    await request(app)
      .post('/me/avatar')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(400);
  });

  it('401 — unauthenticated request rejected', async () => {
    await request(app)
      .post('/me/avatar')
      .attach('photo', TINY_PNG, { filename: 'avatar.png', contentType: 'image/png' })
      .expect(401);
  });

});
