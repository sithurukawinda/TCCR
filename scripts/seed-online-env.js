'use strict';
/**
 * Seeds test accounts into the online Firebase project using credentials
 * from .env.local — no JSON key file needed.
 * Usage: node scripts/seed-online-env.js
 */
const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

// ── load .env.local manually ──────────────────────────────────────────────────
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

const USERS = [
  { email: 'superadmin@cmp.com', password: 'SuperAdmin@123', firstName: 'Super',  lastName: 'Admin', role: 'super_admin', roles: ['super_admin'],          status: 'approved' },
  { email: 'admin@cmp.com',      password: 'Admin@12345',    firstName: 'System', lastName: 'Admin', role: 'admin',       roles: ['admin'],                 status: 'approved' },
  { email: 'student1@cmp.com',      password: 'Student1@123',   firstName: 'Test',  lastName: 'One',    role: 'student', roles: ['member', 'student'],  status: 'approved' },
  { email: 'student2@cmp.com',      password: 'Student2@123',   firstName: 'Test',  lastName: 'Two',    role: 'student', roles: ['member', 'student'],  status: 'approved' },
  { email: 'saman.leader@tccr.lk',  password: 'Leader@12345',   firstName: 'Saman',  lastName: 'Silva',   role: 'leader',  roles: ['member', 'leader'],        status: 'approved' },
  { email: 'leader@cmp.com',         password: 'Leader@12345',   firstName: 'Test',   lastName: 'Leader',  role: 'leader',  roles: ['member', 'leader'],        status: 'approved' },
  { email: 'g12leader@cmp.com',      password: 'G12Lead@123',    firstName: 'Test',   lastName: 'G12',     role: 'g12',     roles: ['member', 'g12'],           status: 'approved' },
];

async function deleteIfExists(email) {
  try { const u = await auth.getUserByEmail(email); await auth.deleteUser(u.uid); } catch (_) {}
}

async function seed() {
  console.log(`\nSeeding online Firebase (${env.FIREBASE_PROJECT_ID})…\n`);
  const now = new Date().toISOString();

  for (const u of USERS) {
    await deleteIfExists(u.email);
    const record = await auth.createUser({ email: u.email, password: u.password, displayName: `${u.firstName} ${u.lastName}` });
    await auth.setCustomUserClaims(record.uid, { role: u.role, roles: u.roles });

    const batch = db.batch();
    batch.set(db.collection('users').doc(record.uid), {
      email: u.email, firstName: u.firstName, lastName: u.lastName,
      role: u.role, roles: u.roles, status: u.status,
      profilePhotoUrl: null, createdAt: now, updatedAt: now, deletedAt: null,
    });
    if (u.role === 'student') {
      batch.set(db.collection('registrations').doc(record.uid), {
        id: record.uid, studentUid: record.uid, email: u.email,
        firstName: u.firstName, lastName: u.lastName,
        state: 'approved', reason: null, createdAt: now, updatedAt: now,
      });
    }
    await batch.commit();
    console.log(`✓  ${u.role.padEnd(12)} ${u.email}  (uid: ${record.uid})`);
  }
  console.log('\n✅  Online seed complete.\n');
  process.exit(0);
}

seed().catch(e => { console.error('❌  Seed FAILED:', e.message); process.exit(1); });
