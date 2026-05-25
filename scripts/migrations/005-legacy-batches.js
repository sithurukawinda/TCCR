/**
 * Migration M5 — Create a 'Legacy' batch for every existing course and
 * backfill enrollments.batchId where it is missing.
 *
 * Idempotent: safe to re-run. Already-created batches and already-backfilled
 * enrollments are skipped.
 *
 * Usage:
 *   node scripts/migrations/005-legacy-batches.js path/to/serviceAccount.json
 *   (or set GOOGLE_APPLICATION_CREDENTIALS env var)
 */

'use strict';

const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

// ── Init ─────────────────────────────────────────────────────────────────────

const serviceAccountPath = process.argv[2];
if (serviceAccountPath) {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else {
  admin.initializeApp(); // uses GOOGLE_APPLICATION_CREDENTIALS
}

const db = admin.firestore();

// ── Constants ─────────────────────────────────────────────────────────────────

const LEGACY_BATCH_NAME = 'Legacy (Pre-V2)';
const now = new Date().toISOString();
const today = now.split('T')[0];
const farFuture = '2099-12-31';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getOrCreateLegacyBatch(courseId) {
  const batchesCol = db.collection('batches');

  // Check if a legacy batch already exists for this course
  const existing = await batchesCol
    .where('courseId', '==', courseId)
    .where('name', '==', LEGACY_BATCH_NAME)
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0];
    console.log(`  [SKIP] Course ${courseId} already has Legacy batch: ${doc.id}`);
    return doc.id;
  }

  // Create new Legacy batch
  const batchId = uuidv4();
  await batchesCol.doc(batchId).set({
    courseId,
    name:            LEGACY_BATCH_NAME,
    scheduledOpenAt: null,
    intakeStart:     today,
    intakeEnd:       farFuture,
    capacity:        null,
    state:           'open',
    createdAt:       now,
    updatedAt:       now,
  });

  console.log(`  [CREATE] Course ${courseId} → Legacy batch: ${batchId}`);
  return batchId;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log('M5 — Creating Legacy batches and backfilling enrollments.batchId');
  console.log('================================================================');

  // 1. Get all non-deleted courses
  const coursesSnap = await db.collection('courses')
    .where('deletedAt', '==', null)
    .get();

  console.log(`Found ${coursesSnap.size} active courses`);

  // Map courseId → legacyBatchId
  const courseBatchMap = new Map();

  for (const courseDoc of coursesSnap.docs) {
    const courseId = courseDoc.id;
    process.stdout.write(`Course ${courseId} (${courseDoc.data().title ?? 'untitled'}): `);
    const batchId = await getOrCreateLegacyBatch(courseId);
    courseBatchMap.set(courseId, batchId);
  }

  console.log(`\nBackfilling enrollments.batchId...`);

  // 2. Find enrollments without batchId
  const enrollmentsSnap = await db.collection('enrollments').get();
  let backfilled = 0;
  let skipped = 0;

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let batchCount = 0;

  for (const enrollDoc of enrollmentsSnap.docs) {
    const data = enrollDoc.data();

    // Skip if already has a batchId
    if (data.batchId) {
      skipped++;
      continue;
    }

    const legacyBatchId = courseBatchMap.get(data.courseId);
    if (!legacyBatchId) {
      console.warn(`  [WARN] No Legacy batch found for courseId ${data.courseId} on enrollment ${enrollDoc.id}`);
      continue;
    }

    batch.update(enrollDoc.ref, { batchId: legacyBatchId, updatedAt: now });
    backfilled++;
    batchCount++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) await batch.commit();

  console.log(`\nDone.`);
  console.log(`  Legacy batches created/verified: ${courseBatchMap.size}`);
  console.log(`  Enrollments backfilled:          ${backfilled}`);
  console.log(`  Enrollments already had batchId: ${skipped}`);
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
