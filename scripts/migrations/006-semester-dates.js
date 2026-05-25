/**
 * Migration M6 — Set openDate = createdAt and endDate = null on all semesters
 * that don't already have openDate set.
 *
 * Idempotent: semesters that already have openDate are skipped.
 *
 * Usage:
 *   node scripts/migrations/006-semester-dates.js path/to/serviceAccount.json
 *   (or set GOOGLE_APPLICATION_CREDENTIALS env var)
 */

'use strict';

const admin = require('firebase-admin');

// ── Init ─────────────────────────────────────────────────────────────────────

const serviceAccountPath = process.argv[2];
if (serviceAccountPath) {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else {
  admin.initializeApp();
}

const db = admin.firestore();

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log('M6 — Backfilling semester openDate / endDate fields');
  console.log('====================================================');

  const now = new Date().toISOString();

  // Query all non-deleted semesters that don't have openDate yet
  // Firestore doesn't support "field does not exist" queries directly,
  // so we fetch all and filter in memory.
  const snap = await db.collection('semesters').get();

  let updated = 0;
  let skipped = 0;

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snap.docs) {
    const data = doc.data();

    // Skip soft-deleted
    if (data.deletedAt) {
      skipped++;
      continue;
    }

    // Skip if already has openDate set
    if (data.openDate !== undefined && data.openDate !== null) {
      skipped++;
      continue;
    }

    // Set openDate = createdAt (when the semester was originally created)
    // Set endDate = null (no end date; Scheduled Jobs will set it if needed)
    const openDate = data.createdAt
      ? (data.createdAt as string).split('T')[0]  // extract YYYY-MM-DD
      : now.split('T')[0];

    batch.update(doc.ref, {
      openDate,
      endDate:   null,
      status:    data.status ?? 'active',
      updatedAt: now,
    });

    updated++;
    batchCount++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
      console.log(`  Committed batch of ${BATCH_SIZE}...`);
    }
  }

  if (batchCount > 0) await batch.commit();

  console.log(`\nDone.`);
  console.log(`  Semesters updated (openDate set): ${updated}`);
  console.log(`  Semesters skipped (already set or deleted): ${skipped}`);
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
