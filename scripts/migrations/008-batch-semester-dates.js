'use strict';
/**
 * Migration 008 — Populate batch_semesters collection from existing semester dates.
 *
 * Background:
 *   Semesters previously stored openDate/endDate directly. This migration creates
 *   batch_semesters join documents so per-batch scheduling can be managed independently.
 *
 * What this script does:
 *   1. For each course, loads its semesters and batches.
 *   2. If the course has batches: inserts batch_semesters rows for every
 *      (batch, semester) pair, carrying the semester's existing openDate/endDate
 *      (or null if the semester had no dates).
 *   3. If the course has semesters with dates but NO batches: creates a single
 *      "Default intake" batch spanning MIN(openDate)→MAX(endDate), then inserts rows.
 *   4. If the course has neither batches nor dated semesters: skipped.
 *
 * Safe to run multiple times — uses set({ merge: true }).
 *
 * Usage:
 *   node scripts/migrations/008-batch-semester-dates.js
 *   node scripts/migrations/008-batch-semester-dates.js --dry-run
 */

const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

// ── Env / credentials ─────────────────────────────────────────────────────────
const envFile = path.resolve(__dirname, '../../.env.local');
if (fs.existsSync(envFile)) {
  require('dotenv').config({ path: envFile });
}

const dryRun = process.argv.includes('--dry-run');

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  : null;

if (!serviceAccount && !admin.apps.length) {
  console.error('ERROR: Set FIREBASE_SERVICE_ACCOUNT_JSON or run with emulator env vars.');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// ── Helpers ───────────────────────────────────────────────────────────────────

function minDate(...dates) {
  return dates.filter(Boolean).sort()[0] ?? null;
}

function maxDate(...dates) {
  return dates.filter(Boolean).sort().reverse()[0] ?? null;
}

async function run() {
  console.log(dryRun ? '[DRY RUN] No writes will be made.\n' : '');

  // Load all courses
  const coursesSnap = await db.collection('courses').where('deletedAt', '==', null).get();
  console.log(`Found ${coursesSnap.size} active courses.`);

  let bsCreated    = 0;
  let batchCreated = 0;
  let skipped      = 0;

  for (const courseDoc of coursesSnap.docs) {
    const courseId = courseDoc.id;

    // Load semesters (non-deleted)
    const semSnap = await db.collection('semesters')
      .where('courseId', '==', courseId)
      .where('deletedAt', '==', null)
      .get();
    if (semSnap.empty) { skipped++; continue; }

    const semesters = semSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Load batches
    const batchSnap = await db.collection('batches')
      .where('courseId', '==', courseId)
      .get();
    let batches = batchSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // If no batches but semesters have dates → create a default batch
    if (batches.length === 0) {
      const datedSems = semesters.filter(s => s.openDate || s.endDate);
      if (datedSems.length === 0) { skipped++; continue; }

      const intakeStart = minDate(...datedSems.map(s => s.openDate));
      const intakeEnd   = maxDate(...datedSems.map(s => s.endDate));

      const newBatchId = db.collection('batches').doc().id;
      const now        = new Date().toISOString();
      const newBatch   = {
        courseId,
        name:            'Default intake',
        scheduledOpenAt: null,
        intakeStart:     intakeStart ?? now.slice(0, 10),
        intakeEnd:       intakeEnd   ?? now.slice(0, 10),
        capacity:        null,
        state:           'open',
        createdAt:       now,
        updatedAt:       now,
      };

      if (!dryRun) {
        await db.collection('batches').doc(newBatchId).set(newBatch);
      }
      console.log(`  [course ${courseId}] Created default batch ${newBatchId} (${newBatch.intakeStart} → ${newBatch.intakeEnd})`);
      batchCreated++;
      batches = [{ id: newBatchId, ...newBatch }];
    }

    // Create batch_semesters rows for every (batch, semester) pair
    const batchWrites = db.batch();
    let rowCount = 0;

    for (const batch of batches) {
      for (const sem of semesters) {
        const docId  = `${batch.id}_${sem.id}`;
        const docRef = db.collection('batch_semesters').doc(docId);
        const now    = new Date().toISOString();
        const row    = {
          batchId:    batch.id,
          semesterId: sem.id,
          courseId,
          openDate:   sem.openDate  ?? null,
          endDate:    sem.endDate   ?? null,
          createdAt:  now,
          updatedAt:  now,
        };

        if (!dryRun) {
          batchWrites.set(docRef, row, { merge: true });
        }
        rowCount++;
        bsCreated++;
      }
    }

    if (!dryRun && rowCount > 0) {
      await batchWrites.commit();
    }

    console.log(`  [course ${courseId}] ${dryRun ? 'Would write' : 'Wrote'} ${rowCount} batch_semester rows (${batches.length} batches × ${semesters.length} semesters).`);
  }

  console.log('\n── Summary ──────────────────────────────────────');
  console.log(`  Courses processed : ${coursesSnap.size - skipped}`);
  console.log(`  Courses skipped   : ${skipped}`);
  console.log(`  Default batches   : ${batchCreated}`);
  console.log(`  batch_semesters   : ${bsCreated}`);
  if (dryRun) console.log('\n  [DRY RUN] No data was written.');
  console.log('─────────────────────────────────────────────────\n');
}

run().catch(err => { console.error(err); process.exit(1); });
