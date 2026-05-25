'use strict';
/**
 * Migration 004 — Verify migration results (READ ONLY — writes nothing).
 *
 * Samples 10 random users and prints their roles[] and Firebase claims
 * so you can visually confirm the migration worked correctly.
 *
 * Usage: node scripts/migrations/004-verify-migration.js
 */

const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

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
      return env;
    }
  }
  throw new Error('No .env or .env.local file found');
}

const env = loadEnv();

admin.initializeApp({
  credential: admin.credential.cert({
    projectId:   env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey:  env.FIREBASE_PRIVATE_KEY,
  }),
});

const db   = admin.firestore();
const auth = admin.auth();

async function run() {
  console.log('\n▶  Migration Verification\n');

  // ── Firestore users check ─────────────────────────────────────────────────
  const snapshot = await db.collection('users').limit(10).get();
  let missingRoles = 0;

  console.log('── Firestore users (sample of up to 10) ─────────────────────');
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const hasRoles = Array.isArray(data.roles) && data.roles.length > 0;
    if (!hasRoles) missingRoles++;
    const flag = hasRoles ? '✅' : '❌';
    console.log(`  ${flag}  ${data.email?.padEnd(35)} role: ${String(data.role).padEnd(12)} roles: ${JSON.stringify(data.roles)}`);
  }

  // ── Firebase claims check ─────────────────────────────────────────────────
  console.log('\n── Firebase Auth claims (sample of up to 10) ────────────────');
  const listResult = await auth.listUsers(10);
  let missingClaims = 0;

  for (const user of listResult.users) {
    const claims   = user.customClaims ?? {};
    const hasRoles = Array.isArray(claims.roles) && claims.roles.length > 0;
    if (!hasRoles) missingClaims++;
    const flag = hasRoles ? '✅' : '❌';
    console.log(`  ${flag}  ${user.email?.padEnd(35)} claims: ${JSON.stringify(claims)}`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n── Summary ───────────────────────────────────────────────────');
  if (missingRoles === 0 && missingClaims === 0) {
    console.log('  ✅  Migration looks correct — all sampled users have roles[]\n');
  } else {
    if (missingRoles  > 0) console.log(`  ❌  ${missingRoles} Firestore user(s) missing roles[] — re-run 001`);
    if (missingClaims > 0) console.log(`  ❌  ${missingClaims} Firebase Auth user(s) missing claims roles[] — re-run 002`);
    console.log();
  }
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
