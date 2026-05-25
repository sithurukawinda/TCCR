'use strict';
/**
 * Migration 002 — Backfill Firebase Auth custom claims to include roles[].
 *
 * V1 claims: { role: "student" }
 * V2 claims: { role: "student", roles: ["member","student"] }
 *
 * Keeps the old `role` scalar for backward compatibility during transition.
 * Safe to run multiple times — skips users whose claims already have `roles`.
 *
 * Usage: node scripts/migrations/002-backfill-firebase-claims.js
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
      console.log(`Loaded credentials from ${file}`);
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

const auth = admin.auth();

function buildRoles(role) {
  switch (role) {
    case 'student':     return ['member', 'student'];
    case 'admin':       return ['admin'];
    case 'super_admin': return ['super_admin'];
    default:            return ['member'];
  }
}

async function run() {
  console.log('\n▶  Migration 002 — Backfill Firebase custom claims\n');

  let pageToken;
  let updated = 0;
  let skipped = 0;
  let failed  = 0;
  let total   = 0;

  do {
    const listResult = await auth.listUsers(1000, pageToken);
    pageToken = listResult.pageToken;

    for (const user of listResult.users) {
      total++;
      const claims = user.customClaims ?? {};

      // Skip if already has roles array
      if (Array.isArray(claims.roles) && claims.roles.length > 0) {
        skipped++;
        continue;
      }

      const role  = claims.role ?? 'member';
      const roles = buildRoles(role);

      try {
        await auth.setCustomUserClaims(user.uid, { ...claims, role, roles });
        updated++;
        if (updated % 50 === 0) console.log(`   Updated ${updated} users...`);
      } catch (err) {
        console.error(`   Failed for uid ${user.uid}: ${err.message}`);
        failed++;
      }
    }
  } while (pageToken);

  console.log(`\n   Total Firebase Auth users: ${total}`);
  console.log(`✅  Updated : ${updated}`);
  console.log(`⏭   Skipped : ${skipped} (already migrated)`);
  if (failed > 0) console.log(`❌  Failed  : ${failed}`);
  console.log('\n   ⚠  Existing sessions will use new claims on next token refresh (up to 1 hour).\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error(err); process.exit(1); });
