'use strict';
/**
 * Migration 007 — Create missing Firebase Auth accounts for leader/g12 users.
 *
 * Problem: leader and g12 accounts seeded directly into Firestore have no
 * corresponding Firebase Auth entry, so login fails with INVALID_LOGIN_CREDENTIALS.
 *
 * What this script does:
 *   1. Fetches all Firestore users whose `roles` array contains 'leader' or 'g12'.
 *   2. For each, calls admin.auth().getUser(uid) to check whether a Firebase Auth
 *      account already exists.
 *   3. If it does NOT exist → creates it via admin.auth().createUser() using the
 *      EXACT same UID already in Firestore (critical — GET /me looks up by Firebase UID).
 *   4. Sets custom claims { role, roles } to match the Firestore document.
 *
 * The temporary password is set to the value of --temp-password (required).
 * Notify each affected user to change their password immediately after logging in.
 *
 * Safe to run multiple times — users that already have a Firebase Auth account are skipped.
 *
 * Usage:
 *   node scripts/migrations/007-backfill-leader-g12-firebase-auth.js --temp-password=Change@Me2026
 *   node scripts/migrations/007-backfill-leader-g12-firebase-auth.js --temp-password=Change@Me2026 --dry-run
 */

const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args       = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }),
);
const DRY_RUN      = args['dry-run'] === true;
const TEMP_PASSWORD = args['temp-password'];

if (!TEMP_PASSWORD) {
  console.error('\n❌  --temp-password=<password> is required.\n');
  console.error('   Example: node scripts/migrations/007-backfill-leader-g12-firebase-auth.js --temp-password=Change@Me2026\n');
  process.exit(1);
}

// ── load credentials from .env.local / .env ───────────────────────────────────
function loadEnv() {
  const candidates = ['.env.local', '.env'];
  for (const file of candidates) {
    const full = path.resolve(__dirname, '../../', file);
    if (fs.existsSync(full)) {
      const env = {};
      fs.readFileSync(full, 'utf8').split('\n').forEach(line => {
        const m = line.match(/^([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
        if (m) env[m[1]] = m[2].replace(/\\n/g, '\n');
      });
      console.log(`Loaded credentials from ${file}`);
      return env;
    }
  }
  throw new Error('No .env.local or .env file found. Cannot connect to Firebase.');
}

const env = loadEnv();

admin.initializeApp({
  credential: admin.credential.cert({
    projectId:   env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey:  env.FIREBASE_PRIVATE_KEY,
  }),
});

const auth = admin.auth();
const db   = admin.firestore();

async function userExistsInAuth(uid) {
  try {
    await auth.getUser(uid);
    return true;
  } catch (err) {
    if (err.code === 'auth/user-not-found') return false;
    throw err;
  }
}

async function run() {
  console.log(`\n▶  Migration 007 — Backfill Firebase Auth accounts for leader/g12 users`);
  if (DRY_RUN) console.log('   DRY RUN — no changes will be made\n');
  else         console.log('');

  // Fetch all users whose roles includes leader or g12
  const snapshot = await db.collection('users').get();
  const affected  = snapshot.docs.filter(doc => {
    const roles = doc.data().roles ?? [];
    return roles.includes('leader') || roles.includes('g12');
  });

  console.log(`   Total users in DB  : ${snapshot.size}`);
  console.log(`   leader/g12 users   : ${affected.length}\n`);

  if (affected.length === 0) {
    console.log('   Nothing to do.\n');
    process.exit(0);
  }

  let created = 0;
  let skipped = 0;
  let failed  = 0;

  for (const doc of affected) {
    const data        = doc.data();
    const uid         = doc.id;
    const email       = data.email;
    const firstName   = data.firstName ?? '';
    const lastName    = data.lastName  ?? '';
    const displayName = `${firstName} ${lastName}`.trim();
    const roles       = data.roles ?? ['member'];
    const role        = data.role  ?? roles[roles.length - 1];

    const alreadyExists = await userExistsInAuth(uid);

    if (alreadyExists) {
      console.log(`⏭   SKIP    ${email} (uid: ${uid}) — Firebase Auth account exists`);
      skipped++;
      continue;
    }

    console.log(`${DRY_RUN ? '🔍  DRY-RUN' : '🔧  CREATE '} ${email} (uid: ${uid}, roles: [${roles.join(', ')}])`);

    if (!DRY_RUN) {
      try {
        // Must pass uid explicitly so Firestore doc ID == Firebase Auth UID
        await auth.createUser({
          uid,
          email,
          password:    TEMP_PASSWORD,
          displayName,
        });

        await auth.setCustomUserClaims(uid, { role, roles });

        created++;
        console.log(`✅  CREATED ${email}`);
      } catch (err) {
        console.error(`❌  FAILED  ${email}: ${err.message}`);
        failed++;
      }
    } else {
      created++; // count as "would create" in dry-run
    }
  }

  console.log('\n── Summary ───────────────────────────────────────────────────────────────');
  if (DRY_RUN) {
    console.log(`   Would create : ${created}`);
    console.log(`   Would skip   : ${skipped} (already in Firebase Auth)`);
  } else {
    console.log(`✅  Created  : ${created}`);
    console.log(`⏭   Skipped  : ${skipped} (already in Firebase Auth)`);
    if (failed > 0) console.log(`❌  Failed   : ${failed}`);
  }

  if (created > 0 && !DRY_RUN) {
    console.log('\n   ⚠  IMPORTANT: all created accounts use the temporary password.');
    console.log(`   ⚠  Temporary password: ${TEMP_PASSWORD}`);
    console.log('   ⚠  Notify each affected user to change their password immediately.\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error('\nFatal:', err.message); process.exit(1); });
