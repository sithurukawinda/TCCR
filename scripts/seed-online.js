/**
 * Seed test users into the ONLINE Firebase project (e-learning-f4209).
 * Safe to re-run — existing users are deleted and re-created.
 *
 * Usage:
 *   node scripts/seed-online.js NewPrivateKey.json
 */
const admin = require('firebase-admin');
const path  = require('path');

const keyPath = process.argv[2];
if (!keyPath) {
  console.error('Usage: node scripts/seed-online.js <serviceAccount.json>');
  process.exit(1);
}

const sa = require(path.resolve(keyPath));
admin.initializeApp({ credential: admin.credential.cert(sa) });

const auth = admin.auth();
const db   = admin.firestore();

const USERS = [
  {
    email:     'superadmin@cmp.com',
    password:  'SuperAdmin@123',
    firstName: 'Super',
    lastName:  'Admin',
    role:      'super_admin',
    status:    'approved',
  },
  {
    email:     'admin@cmp.com',
    password:  'Admin@12345',
    firstName: 'System',
    lastName:  'Admin',
    role:      'admin',
    status:    'approved',
  },
  {
    email:     'student2@cmp.com',
    password:  'Student2@123',
    firstName: 'Test',
    lastName:  'Two',
    role:      'student',
    status:    'approved',
  },
];

async function deleteIfExists(email) {
  try {
    const u = await auth.getUserByEmail(email);
    await auth.deleteUser(u.uid);
    console.log(`  removed: ${email}`);
  } catch (_) {}
}

async function seed() {
  console.log('\nSeeding online Firebase (e-learning-f4209)…\n');
  const now = new Date().toISOString();

  for (const u of USERS) {
    await deleteIfExists(u.email);

    const record = await auth.createUser({
      email:       u.email,
      password:    u.password,
      displayName: `${u.firstName} ${u.lastName}`,
    });

    await auth.setCustomUserClaims(record.uid, { role: u.role, roles: [u.role] });

    const batch = db.batch();

    batch.set(db.collection('users').doc(record.uid), {
      email:           u.email,
      firstName:       u.firstName,
      lastName:        u.lastName,
      role:            u.role,
      roles:           [u.role],
      status:          u.status,
      profilePhotoUrl: null,
      createdAt:       now,
      updatedAt:       now,
      deletedAt:       null,
    });

    if (u.role === 'student') {
      batch.set(db.collection('registrations').doc(record.uid), {
        id:         record.uid,
        studentUid: record.uid,
        email:      u.email,
        firstName:  u.firstName,
        lastName:   u.lastName,
        state:      'approved',
        reason:     null,
        createdAt:  now,
        updatedAt:  now,
      });
    }

    await batch.commit();

    console.log(`✓  ${u.role.padEnd(12)} ${u.email}`);
    console.log(`   Password : ${u.password}`);
    console.log(`   UID      : ${record.uid}\n`);
  }

  console.log('Online seed complete.');
  process.exit(0);
}

seed().catch(e => { console.error('Seed FAILED:', e.message); process.exit(1); });
