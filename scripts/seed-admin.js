/**
 * Creates an admin user in the Firebase Auth + Firestore emulators.
 * Run once: node scripts/seed-admin.js
 */
process.env.FIRESTORE_EMULATOR_HOST      = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST  = '127.0.0.1:9099';

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'demo-cmp' });

const auth = admin.auth();
const db   = admin.firestore();

const ADMIN_EMAIL    = 'admin@cmp.com';
const ADMIN_PASSWORD = 'Admin@123';
const FIRST_NAME     = 'System';
const LAST_NAME      = 'Admin';

async function seed() {
  // Delete existing user if any (idempotent)
  try {
    const existing = await auth.getUserByEmail(ADMIN_EMAIL);
    await auth.deleteUser(existing.uid);
    console.log('Removed existing admin user');
  } catch (_) {}

  const user = await auth.createUser({
    email:       ADMIN_EMAIL,
    password:    ADMIN_PASSWORD,
    displayName: `${FIRST_NAME} ${LAST_NAME}`,
  });

  await auth.setCustomUserClaims(user.uid, { role: 'admin', roles: ['admin'] });

  const now = new Date().toISOString();
  await db.collection('users').doc(user.uid).set({
    email:           ADMIN_EMAIL,
    firstName:       FIRST_NAME,
    lastName:        LAST_NAME,
    role:            'admin',
    roles:           ['admin'],
    status:          'approved',
    profilePhotoUrl: null,
    createdAt:       now,
    updatedAt:       now,
    deletedAt:       null,
  });

  console.log('✓ Admin created');
  console.log('  Email   :', ADMIN_EMAIL);
  console.log('  Password:', ADMIN_PASSWORD);
  console.log('  UID     :', user.uid);
  process.exit(0);
}

seed().catch(e => { console.error(e.message); process.exit(1); });
