'use strict';
/**
 * Migration 003 — Set localeRendered = "en" on all existing notifications.
 *
 * V2 adds per-notification locale tracking. Existing notifications
 * are backfilled with "en" as the default locale.
 *
 * Safe to run multiple times — skips documents that already have localeRendered.
 *
 * Usage: node scripts/migrations/003-backfill-notifications-locale.js
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

const db = admin.firestore();

async function run() {
  console.log('\n▶  Migration 003 — Backfill notifications localeRendered\n');

  const snapshot = await db.collection('notifications').get();
  console.log(`   Found ${snapshot.size} notification documents\n`);

  let updated = 0;
  let skipped = 0;

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    if (data.localeRendered) {
      skipped++;
      continue;
    }

    batch.update(doc.ref, { localeRendered: 'en' });
    updated++;
    count++;

    if (count >= BATCH_SIZE) {
      await batch.commit();
      console.log(`   Committed batch of ${count}`);
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) await batch.commit();

  console.log(`\n✅  Updated : ${updated}`);
  console.log(`⏭   Skipped : ${skipped} (already have locale)\n`);
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
