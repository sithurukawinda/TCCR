'use strict';
/**
 * Creates a brand-new G12 leader user in the ONLINE Firebase project.
 * Reads credentials from .env.local
 *
 * Run: node scripts/seed-new-g12-online.js
 */
const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

// ── Load .env.local credentials ───────────────────────────────────────────────
const envPath = path.resolve(__dirname, '../.env.local');
const env     = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m) env[m[1]] = m[2].replace(/\\n/g, '\n');
});

admin.initializeApp({
  credential: admin.credential.cert({
    projectId:   env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey:  env.FIREBASE_PRIVATE_KEY,
  }),
});

const auth = admin.auth();
const db   = admin.firestore();

const NEW_G12 = {
  email:     'newg12@cmp.com',
  password:  'NewG12@12345',
  firstName: 'Daniel',
  lastName:  'G12Leader',
  role:      'g12',
  roles:     ['member', 'g12'],
  status:    'approved',
};

async function seed() {
  console.log(`\n── Creating new G12 Leader in online Firebase (${env.FIREBASE_PROJECT_ID}) ──\n`);

  // Remove existing if any (idempotent)
  try {
    const existing = await auth.getUserByEmail(NEW_G12.email);
    await auth.deleteUser(existing.uid);
    console.log(`  removed existing account: ${NEW_G12.email}`);
  } catch (_) {}

  // Create Firebase Auth account
  const record = await auth.createUser({
    email:       NEW_G12.email,
    password:    NEW_G12.password,
    displayName: `${NEW_G12.firstName} ${NEW_G12.lastName}`,
  });

  // Set custom claims
  await auth.setCustomUserClaims(record.uid, {
    role:  NEW_G12.role,
    roles: NEW_G12.roles,
  });

  // Write Firestore user document
  const now = new Date().toISOString();
  await db.collection('users').doc(record.uid).set({
    email:                   NEW_G12.email,
    firstName:               NEW_G12.firstName,
    lastName:                NEW_G12.lastName,
    role:                    NEW_G12.role,
    roles:                   NEW_G12.roles,
    status:                  NEW_G12.status,
    profilePhotoUrl:         null,
    preferredLanguage:       'en',
    providers:               ['password'],
    fcmTokens:               [],
    notificationPreferences: { email: true, push: true },
    createdAt:               now,
    updatedAt:               now,
    deletedAt:               null,
  });

  console.log('✅  New G12 Leader created in online Firebase!\n');
  console.log('┌─────────────────────────────────────────────┐');
  console.log(`│  Name     : ${NEW_G12.firstName} ${NEW_G12.lastName}          │`);
  console.log(`│  Email    : ${NEW_G12.email}         │`);
  console.log(`│  Password : ${NEW_G12.password}         │`);
  console.log(`│  Roles    : [${NEW_G12.roles.join(', ')}]             │`);
  console.log(`│  Status   : ${NEW_G12.status}              │`);
  console.log(`│  UID      : ${record.uid}  │`);
  console.log('└─────────────────────────────────────────────┘\n');

  process.exit(0);
}

seed().catch(e => { console.error('\n❌ Error:', e.message); process.exit(1); });
