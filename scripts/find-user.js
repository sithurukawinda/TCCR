'use strict';
/**
 * Quick search: find a user by email across all collections.
 * Usage: node scripts/find-user.js <email>
 */
const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

const email = process.argv[2];
if (!email) { console.error('Usage: node scripts/find-user.js <email>'); process.exit(1); }

function loadEnv(filename) {
  const p = path.resolve(__dirname, '..', filename);
  if (!fs.existsSync(p)) return {};
  const result = {};
  fs.readFileSync(p, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*"?(.*?)"?\s*$/);
    if (m) result[m[1]] = m[2].replace(/\\n/g, '\n');
  });
  return result;
}
const env = { ...loadEnv('.env.local'), ...loadEnv('.env') };

admin.initializeApp({
  credential: admin.credential.cert({
    projectId:   env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey:  env.FIREBASE_PRIVATE_KEY,
  }),
});

const db   = admin.firestore();
const auth = admin.auth();

(async () => {
  console.log('\n🔍  Searching for:', email, '\n');

  // Firebase Auth
  try {
    const u = await auth.getUserByEmail(email);
    console.log('🔐  Firebase Auth  : FOUND');
    console.log('    UID     :', u.uid);
    console.log('    Name    :', u.displayName || '(not set)');
    console.log('    Created :', u.metadata.creationTime);
    console.log('    Disabled:', u.disabled);
  } catch {
    console.log('🔐  Firebase Auth  : NOT FOUND');
  }

  // Firestore collections - query by email field
  const topLevel = ['users', 'registrations', 'role_requests', 'enrollments',
                    'notifications', 'audit_log', 'outbox', 'cell_groups'];
  for (const col of topLevel) {
    try {
      const snap = await db.collection(col).where('email', '==', email).limit(5).get();
      if (!snap.empty) {
        console.log(`📄  ${col.padEnd(20)}: FOUND (${snap.size} doc) — IDs: ${snap.docs.map(d => d.id).join(', ')}`);
      } else {
        console.log(`    ${col.padEnd(20)}: not found`);
      }
    } catch (e) {
      console.log(`    ${col.padEnd(20)}: query err — ${e.message}`);
    }
  }

  // Also search loginAttempts and OTP collections (keyed by email — direct lookup)
  for (const col of ['loginAttempts', 'emailVerificationOtps', 'passwordResetOtps']) {
    const doc = await db.collection(col).doc(email).get();
    if (doc.exists) {
      console.log(`📄  ${col.padEnd(20)}: FOUND (doc keyed by email)`);
    } else {
      console.log(`    ${col.padEnd(20)}: not found`);
    }
  }

  console.log();
  process.exit(0);
})().catch(err => { console.error('Error:', err); process.exit(1); });
