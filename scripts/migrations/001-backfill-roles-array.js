'use strict';
/**
 * Migration 001 — Backfill roles[] array on every user document.
 *
 * V1 stored a scalar `role: "student"`.
 * V2 requires `roles: ["member","student"]`.
 *
 * Mapping:
 *   student     → ["member","student"]
 *   admin       → ["admin"]
 *   super_admin → ["super_admin"]
 *
 * Safe to run multiple times — skips documents that already have `roles`.
 *
 * Usage: node scripts/migrations/001-backfill-roles-array.js
 */

const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

// ── load credentials from .env ────────────────────────────────────────────────
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

const db = admin.firestore();

function buildRoles(role) {
  switch (role) {
    case 'student':     return ['member', 'student'];
    case 'admin':       return ['admin'];
    case 'super_admin': return ['super_admin'];
    default:            return ['member'];
  }
}

async function run() {
  console.log('\n▶  Migration 001 — Backfill roles[] array\n');

  const snapshot = await db.collection('users').get();
  console.log(`   Found ${snapshot.size} user documents\n`);

  let updated = 0;
  let skipped = 0;
  let failed  = 0;

  const BATCH_SIZE = 400;
  let batch  = db.batch();
  let count  = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Skip if already has roles array (idempotent)
    if (Array.isArray(data.roles) && data.roles.length > 0) {
      skipped++;
      continue;
    }

    const roles = buildRoles(data.role);
    const updates = {
      roles,
      preferredLanguage: data.preferredLanguage ?? 'en',
    };

    batch.update(doc.ref, updates);
    updated++;
    count++;

    if (count >= BATCH_SIZE) {
      try {
        await batch.commit();
        console.log(`   Committed batch of ${count}`);
      } catch (err) {
        console.error('   Batch commit failed:', err.message);
        failed += count;
      }
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    try {
      await batch.commit();
    } catch (err) {
      console.error('   Final batch commit failed:', err.message);
      failed += count;
    }
  }

  console.log(`\n✅  Updated : ${updated}`);
  console.log(`⏭   Skipped : ${skipped} (already migrated)`);
  if (failed > 0) console.log(`❌  Failed  : ${failed}`);
  console.log('\n   Run 004-verify-migration.js to confirm results.\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error(err); process.exit(1); });
