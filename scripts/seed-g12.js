/**
 * Creates the g12 user in both Firebase Auth + Firestore emulators.
 * Run once: node scripts/seed-g12.js
 *
 * Fixes: "Email or password is incorrect" when g12 user exists in
 * Firestore but has no Firebase Auth account.
 */
process.env.FIRESTORE_EMULATOR_HOST     = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

function resolveProjectId() {
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
  try {
    const rc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.firebaserc'), 'utf8'));
    return rc.projects?.default ?? 'demo-cmp';
  } catch (_) {
    return 'demo-cmp';
  }
}

const PROJECT_ID = resolveProjectId();
console.log(`\nProject: ${PROJECT_ID}`);

admin.initializeApp({ projectId: PROJECT_ID });

const auth = admin.auth();
const db   = admin.firestore();

const G12_USER = {
  email:     'g12leader@cmp.com',
  password:  'G12Lead@123',
  firstName: 'Test',
  lastName:  'G12',
  role:      'g12',
  roles:     ['member', 'g12'],
  status:    'approved',
};

async function seed() {
  console.log('\n── Seeding g12 user into Firebase Auth + Firestore emulators ──\n');

  // Remove existing Firebase Auth account if any (idempotent)
  try {
    const existing = await auth.getUserByEmail(G12_USER.email);
    await auth.deleteUser(existing.uid);
    console.log(`  removed existing Firebase Auth account: ${G12_USER.email}`);
  } catch (_) {}

  // Create Firebase Auth account
  const record = await auth.createUser({
    email:       G12_USER.email,
    password:    G12_USER.password,
    displayName: `${G12_USER.firstName} ${G12_USER.lastName}`,
  });

  // Set custom claims
  await auth.setCustomUserClaims(record.uid, {
    role:  G12_USER.role,
    roles: G12_USER.roles,
  });

  // Write / overwrite Firestore user document
  const now = new Date().toISOString();
  await db.collection('users').doc(record.uid).set({
    email:                   G12_USER.email,
    firstName:               G12_USER.firstName,
    lastName:                G12_USER.lastName,
    role:                    G12_USER.role,
    roles:                   G12_USER.roles,
    status:                  G12_USER.status,
    profilePhotoUrl:         null,
    preferredLanguage:       'en',
    providers:               ['password'],
    fcmTokens:               [],
    notificationPreferences: { email: true, push: true },
    createdAt:               now,
    updatedAt:               now,
    deletedAt:               null,
  });

  console.log(`\n✅  g12 user created successfully!\n`);
  console.log(`   Email    : ${G12_USER.email}`);
  console.log(`   Password : ${G12_USER.password}`);
  console.log(`   Roles    : [${G12_USER.roles.join(', ')}]`);
  console.log(`   Status   : ${G12_USER.status}`);
  console.log(`   UID      : ${record.uid}\n`);

  process.exit(0);
}

seed().catch(e => { console.error('\n❌ Error:', e.message); process.exit(1); });
