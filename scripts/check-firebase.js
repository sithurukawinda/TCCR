'use strict';
/**
 * Quick connectivity check against online Firebase.
 * Usage: node scripts/check-firebase.js
 */
const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

const envPath = path.resolve(__dirname, '../.env.local');
const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m) env[m[1]] = m[2].replace(/\\n/g, '\n');
});

console.log('\n🔍  Firebase Connectivity Check');
console.log('────────────────────────────────────────');
console.log('  Project ID   :', env.FIREBASE_PROJECT_ID   || '(missing)');
console.log('  Client Email :', env.FIREBASE_CLIENT_EMAIL || '(missing)');
console.log('  Private Key  :', env.FIREBASE_PRIVATE_KEY  ? '*** (present)' : '(missing)');
console.log('  Storage Bucket:', env.FIREBASE_STORAGE_BUCKET || '(missing)');
console.log('────────────────────────────────────────\n');

if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
  console.error('❌  One or more required Firebase credentials are missing in .env.local');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId:   env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey:  env.FIREBASE_PRIVATE_KEY,
  }),
  storageBucket: env.FIREBASE_STORAGE_BUCKET,
});

const db   = admin.firestore();
const auth = admin.auth();

async function check() {
  const results = [];

  // 1. Firestore — read users collection
  try {
    const snap = await db.collection('users').limit(3).get();
    results.push(`✅  Firestore     — OK  (${snap.size} doc(s) returned from 'users')`);
  } catch (e) {
    results.push(`❌  Firestore     — FAILED: ${e.message}`);
  }

  // 2. Firebase Auth — list users
  try {
    const list = await auth.listUsers(3);
    results.push(`✅  Firebase Auth — OK  (${list.users.length} user(s) fetched)`);
  } catch (e) {
    results.push(`❌  Firebase Auth — FAILED: ${e.message}`);
  }

  // 3. Outbox collection (sanity check for cross-service data)
  try {
    const snap = await db.collection('outbox').limit(1).get();
    results.push(`✅  Outbox coll.  — OK  (${snap.size} doc(s) in 'outbox')`);
  } catch (e) {
    results.push(`❌  Outbox coll.  — FAILED: ${e.message}`);
  }

  results.forEach(r => console.log('  ' + r));
  console.log();

  const failed = results.filter(r => r.startsWith('  ❌'));
  if (failed.length === 0) {
    console.log('✅  All checks passed — online Firebase is reachable.\n');
    process.exit(0);
  } else {
    console.error(`❌  ${failed.length} check(s) failed.\n`);
    process.exit(1);
  }
}

check().catch(e => {
  console.error('❌  Unexpected error:', e.message);
  process.exit(1);
});
