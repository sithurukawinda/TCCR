'use strict';
/**
 * scripts/cleanup-duplicate-role-requests.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Removes duplicate role_requests documents, keeping the newest per
 * (requesterUid, requestedRole) combination.
 *
 * This is a one-time cleanup for duplicates created before the
 * ROLE_ALREADY_GRANTED guard was added to CreateRoleRequestUseCase.
 *
 * Usage
 * ─────
 *  node scripts/cleanup-duplicate-role-requests.js           # dry run (safe preview)
 *  node scripts/cleanup-duplicate-role-requests.js --execute # actually deletes
 */

const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const execute = args.includes('--execute');
const dryRun  = !execute;

if (dryRun) {
  console.log('DRY RUN — pass --execute to actually delete documents.\n');
}

// ── Load .env.local then .env (same pattern as purge-user.js) ────────────────
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

// ── Firebase init ─────────────────────────────────────────────────────────────
admin.initializeApp({
  credential: admin.credential.cert({
    projectId:   env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey:  env.FIREBASE_PRIVATE_KEY,
  }),
});

const db = admin.firestore();
const BATCH_SIZE = 400; // Firestore max is 500; keep headroom

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Fetching all role_requests...');
  const snap = await db.collection('role_requests').orderBy('createdAt', 'desc').get();
  console.log(`Total documents found: ${snap.size}\n`);

  // Group docs by (requesterUid, requestedRole)
  const groups = new Map(); // key → [docRef, ...]  (already newest-first from orderBy desc)
  snap.docs.forEach(doc => {
    const { requesterUid, requestedRole } = doc.data();
    const key = `${requesterUid}::${requestedRole}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(doc);
  });

  // Collect refs to delete (all but the first/newest in each group)
  const toDelete = [];
  for (const [key, docs] of groups) {
    if (docs.length <= 1) continue;
    const keep = docs[0]; // newest (orderBy desc)
    const drop = docs.slice(1);
    console.log(`Duplicate group: ${key}`);
    console.log(`  Keep (newest): ${keep.id}  createdAt=${keep.data().createdAt}`);
    drop.forEach(d => {
      console.log(`  Delete:        ${d.id}  createdAt=${d.data().createdAt}  status=${d.data().status}`);
      toDelete.push(d.ref);
    });
    console.log();
  }

  if (toDelete.length === 0) {
    console.log('No duplicates found. Nothing to delete.');
    process.exit(0);
  }

  console.log(`\nTotal to delete: ${toDelete.length}`);

  if (dryRun) {
    console.log('\nDRY RUN complete. Run with --execute to apply deletions.');
    process.exit(0);
  }

  // Delete in batches of BATCH_SIZE
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const chunk = toDelete.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach(ref => batch.delete(ref));
    await batch.commit();
    deleted += chunk.size || chunk.length;
    console.log(`Deleted batch of ${chunk.length} (total so far: ${deleted})`);
  }

  console.log(`\nDone. Deleted ${deleted} duplicate role_request documents.`);
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message ?? err);
  process.exit(1);
});
