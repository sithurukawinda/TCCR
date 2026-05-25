/**
 * Runs in the same Jest VM context BEFORE each test file is loaded.
 * Sets Firebase emulator environment variables so that all subsequent
 * require() / import() calls within the test file use the emulator.
 * Also initialises the Firebase Admin SDK once so container.ts can
 * call getFirestore() / getAuth() without throwing.
 */

// ── Emulator hosts ────────────────────────────────────────────────────────────
process.env.FIRESTORE_EMULATOR_HOST    = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

// ── Fake Firebase credentials (accepted by emulator) ─────────────────────────
// Generate a syntactically valid RSA key so cert() can parse it.
// The emulator never validates the actual key value.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generateKeyPairSync } = require('crypto');
const { privateKey: fakePrivateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
// Use the same project ID the emulator is running under (from .firebaserc default).
// The emulator's issued ID tokens carry this project as their "aud" claim, so the
// Admin SDK project must match for verifyIdToken to succeed.
process.env.FIREBASE_PROJECT_ID    = 'e-learning-f4209';
process.env.FIREBASE_CLIENT_EMAIL  = 'fake@fake.com';
process.env.FIREBASE_PRIVATE_KEY   = fakePrivateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
process.env.FIREBASE_STORAGE_BUCKET = 'e-learning-f4209.appspot.com';
process.env.FIREBASE_WEB_API_KEY   = 'fake-key';

// ── Service configuration ─────────────────────────────────────────────────────
process.env.INTERNAL_SERVICE_KEY   = 'test-secret';
process.env.NODE_ENV               = 'test';
process.env.LOG_LEVEL              = 'silent';

// ── Initialise Firebase Admin SDK ─────────────────────────────────────────────
// Must run before any module that calls getFirestore() / getAuth() is loaded.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { initFirebaseAdmin } = require('./../../packages/shared/firebase/src/index');
initFirebaseAdmin();
