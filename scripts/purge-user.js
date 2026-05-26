'use strict';
/**
 * scripts/purge-user.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PERMANENT / IRREVERSIBLE hard-delete of a user from every corner of the
 * database.  Use this when a user must be fully erased (GDPR, test cleanup,
 * orphaned account).
 *
 * Collections purged
 * ──────────────────
 *  Firebase Auth        → account deleted
 *  users                → profile document deleted
 *  loginAttempts        → keyed by email
 *  emailVerificationOtps→ keyed by email
 *  passwordResetOtps    → keyed by email
 *  registrations        → keyed by uid (V1 approval record)
 *  role_requests        → where requesterUid == uid
 *  enrollments          → where studentUid == uid
 *  progress             → where studentUid == uid
 *  notifications        → where userUid == uid
 *  audit_log            → where actorUid == uid
 *  outbox               → where payload.uid == uid (best-effort)
 *  cell_groups.members  → uid removed from every cell's members array
 *  join_requests (sub)  → collection-group query where requestedBy == uid
 *
 * Collections NOT touched (by design)
 * ─────────────────────────────────────
 *  cell_reports         → belong to the cell group, not the user
 *  courses/semesters/subjects/lessons → content; not user-owned
 *
 * Usage
 * ─────
 *  node scripts/purge-user.js sapnanethmi128@gmail.com
 *  node scripts/purge-user.js sapnanethmi128@gmail.com --dry-run
 *
 *  --dry-run   Shows exactly what WOULD be deleted without touching anything.
 */

const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args   = process.argv.slice(2);
const email  = args.find(a => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');

if (!email) {
  console.error('Usage: node scripts/purge-user.js <email> [--dry-run]');
  process.exit(1);
}

// ── Load .env (fallback to .env.local) ───────────────────────────────────────
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

const db   = admin.firestore();
const auth = admin.auth();

// ── Helpers ───────────────────────────────────────────────────────────────────
const BATCH_SIZE = 400; // Firestore max is 500; keep headroom

/** Delete all docs returned by a query in batches of BATCH_SIZE. */
async function deleteQuery(query, label) {
  let total = 0;
  let snap  = await query.limit(BATCH_SIZE).get();
  while (!snap.empty) {
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    if (!dryRun) await batch.commit();
    total += snap.size;
    console.log(`   ${dryRun ? '[DRY-RUN] would delete' : 'deleted'} ${snap.size} ${label} doc(s) (total: ${total})`);
    if (snap.size < BATCH_SIZE) break;
    snap = await query.startAfter(snap.docs[snap.docs.length - 1]).limit(BATCH_SIZE).get();
  }
  if (total === 0) console.log(`   (none found in ${label})`);
  return total;
}

/** Delete a single document by path (idempotent). */
async function deleteDoc(ref, label) {
  const snap = await ref.get();
  if (!snap.exists) { console.log(`   (no ${label} doc)`); return 0; }
  if (!dryRun) await ref.delete();
  console.log(`   ${dryRun ? '[DRY-RUN] would delete' : 'deleted'} ${label}`);
  return 1;
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const DRY = dryRun ? ' [DRY-RUN]' : '';

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log(`║  PURGE USER${DRY.padEnd(51)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  Email  : ${email}`);
  if (dryRun) console.log('  ⚠️   DRY-RUN — nothing will be deleted\n');
  else        console.log('  ⚠️   PERMANENT — this cannot be undone\n');

  // ── Step 0: Resolve UID ──────────────────────────────────────────────────
  console.log('📋  Step 0 — Resolving UID');
  let authUser   = null;
  let uid        = null;
  let userDocRef = null;
  let userDoc    = null;

  // Try Firebase Auth first
  try {
    authUser = await auth.getUserByEmail(email);
    uid      = authUser.uid;
    console.log(`  ✅  Found in Firebase Auth`);
    console.log(`  UID    : ${uid}`);
    console.log(`  Name   : ${authUser.displayName || '(not set)'}`);
    console.log(`  Created: ${authUser.metadata.creationTime}`);
  } catch {
    console.log('  ⚠️  Not found in Firebase Auth — searching Firestore users by email…');
  }

  // Firestore lookup (always; also used as fallback if Auth returned nothing)
  if (uid) {
    userDocRef = db.collection('users').doc(uid);
    userDoc    = await userDocRef.get();
  } else {
    // Fallback: find by email field in users collection
    const snap = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!snap.empty) {
      userDoc    = snap.docs[0];
      uid        = userDoc.id;
      userDocRef = userDoc.ref;
      console.log(`  ✅  Found in Firestore users (Auth-less record)`);
      console.log(`  UID    : ${uid}`);
    }
  }

  if (!uid) {
    console.error('\n  ❌  User not found in Firebase Auth OR Firestore for email:', email);
    console.error('      Double-check the email address and try again.');
    process.exit(1);
  }

  // Show Firestore profile summary
  if (userDoc && userDoc.exists) {
    const d = userDoc.data();
    console.log(`  Roles  : ${(d.roles || [d.role] || []).join(', ')}`);
    console.log(`  Status : ${d.status || '(not set)'}`);
  } else {
    console.log('  ⚠️  No Firestore users document found (Auth-only account)');
  }
  console.log();

  const summary = {};

  // ── Step 1: Firebase Auth account ───────────────────────────────────────
  console.log('🔐  Step 1 — Firebase Auth account');
  if (authUser) {
    if (!dryRun) {
      await auth.deleteUser(uid);
      console.log(`  ✅  Firebase Auth account deleted`);
    } else {
      console.log(`  [DRY-RUN] would delete Firebase Auth account for UID: ${uid}`);
    }
    summary['Firebase Auth'] = 1;
  } else {
    console.log('  (no Firebase Auth account — skipped)');
    summary['Firebase Auth'] = 0;
  }
  console.log();

  // ── Step 2: users collection ─────────────────────────────────────────────
  console.log('👤  Step 2 — users collection');
  summary['users'] = await deleteDoc(userDocRef, 'users/' + uid);
  console.log();

  // ── Step 3: Email-keyed auth collections ─────────────────────────────────
  console.log('📧  Step 3 — Email-keyed collections (loginAttempts, OTPs)');
  summary['loginAttempts']          = await deleteDoc(db.collection('loginAttempts').doc(email),          'loginAttempts/' + email);
  summary['emailVerificationOtps']  = await deleteDoc(db.collection('emailVerificationOtps').doc(email),  'emailVerificationOtps/' + email);
  summary['passwordResetOtps']      = await deleteDoc(db.collection('passwordResetOtps').doc(email),      'passwordResetOtps/' + email);
  console.log();

  // ── Step 4: registrations (V1 approval record, keyed by uid) ────────────
  console.log('📝  Step 4 — registrations (V1)');
  summary['registrations'] = await deleteDoc(db.collection('registrations').doc(uid), 'registrations/' + uid);
  console.log();

  // ── Step 5: role_requests ────────────────────────────────────────────────
  console.log('🎭  Step 5 — role_requests');
  summary['role_requests'] = await deleteQuery(
    db.collection('role_requests').where('requesterUid', '==', uid),
    'role_requests',
  );
  console.log();

  // ── Step 6: enrollments ──────────────────────────────────────────────────
  console.log('📚  Step 6 — enrollments');
  summary['enrollments'] = await deleteQuery(
    db.collection('enrollments').where('studentUid', '==', uid),
    'enrollments',
  );
  console.log();

  // ── Step 7: progress ─────────────────────────────────────────────────────
  console.log('📈  Step 7 — progress');
  summary['progress'] = await deleteQuery(
    db.collection('progress').where('studentUid', '==', uid),
    'progress',
  );
  console.log();

  // ── Step 8: notifications ────────────────────────────────────────────────
  console.log('🔔  Step 8 — notifications');
  summary['notifications'] = await deleteQuery(
    db.collection('notifications').where('userUid', '==', uid),
    'notifications',
  );
  console.log();

  // ── Step 9: audit_log ────────────────────────────────────────────────────
  console.log('📋  Step 9 — audit_log');
  summary['audit_log'] = await deleteQuery(
    db.collection('audit_log').where('actorUid', '==', uid),
    'audit_log',
  );
  console.log();

  // ── Step 10: outbox (best-effort — payload is a map, not indexed) ────────
  console.log('📤  Step 10 — outbox (pending/failed entries)');
  // We can only find pending/failed outbox entries by querying status and
  // inspecting the payload — outbox docs are not indexed by uid.
  // Delete any pending or failed outbox entries whose payload uid matches.
  let outboxDeleted = 0;
  for (const status of ['pending', 'failed']) {
    let snap = await db.collection('outbox').where('status', '==', status).limit(500).get();
    const toDelete = snap.docs.filter(d => {
      const p = d.data().payload || {};
      return p.uid === uid || p.studentUid === uid || p.actorUid === uid || p.requestedBy === uid;
    });
    if (toDelete.length > 0) {
      const batch = db.batch();
      toDelete.forEach(d => batch.delete(d.ref));
      if (!dryRun) await batch.commit();
      outboxDeleted += toDelete.length;
      console.log(`   ${dryRun ? '[DRY-RUN] would delete' : 'deleted'} ${toDelete.length} outbox[${status}] doc(s)`);
    }
  }
  if (outboxDeleted === 0) console.log('   (no matching outbox entries found)');
  summary['outbox'] = outboxDeleted;
  console.log();

  // ── Step 11: cell_groups — remove uid from members array ─────────────────
  console.log('🏘️   Step 11 — cell_groups (remove from members arrays)');
  const cellSnap = await db.collection('cell_groups')
    .where('members', 'array-contains', uid)
    .get();
  if (!cellSnap.empty) {
    const batch = db.batch();
    cellSnap.docs.forEach(d => {
      batch.update(d.ref, {
        members: admin.firestore.FieldValue.arrayRemove(uid),
      });
    });
    if (!dryRun) await batch.commit();
    console.log(`   ${dryRun ? '[DRY-RUN] would remove' : 'removed'} UID from ${cellSnap.size} cell_group(s)`);
    summary['cell_groups (member removed)'] = cellSnap.size;
  } else {
    console.log('   (not a member of any cell group)');
    summary['cell_groups (member removed)'] = 0;
  }
  console.log();

  // ── Step 12: join_requests sub-collection ────────────────────────────────
  // Uses a collection-group query when the index exists; falls back to
  // iterating every cell_group's sub-collection when the index is missing.
  console.log('🤝  Step 12 — join_requests (cell sub-collections)');
  let joinTotal = 0;
  try {
    joinTotal = await deleteQuery(
      db.collectionGroup('join_requests').where('requestedBy', '==', uid),
      'join_requests',
    );
  } catch (indexErr) {
    if (String(indexErr.message).includes('FAILED_PRECONDITION') || String(indexErr.code) === '9') {
      console.log('   ⚠️  Collection-group index not yet deployed — falling back to manual scan…');
      // Iterate every cell_group and check its join_requests sub-collection
      const cellsSnap = await db.collection('cell_groups').get();
      for (const cellDoc of cellsSnap.docs) {
        const jrSnap = await cellDoc.ref.collection('join_requests')
          .where('requestedBy', '==', uid).get();
        if (!jrSnap.empty) {
          const batch = db.batch();
          jrSnap.docs.forEach(d => batch.delete(d.ref));
          if (!dryRun) await batch.commit();
          joinTotal += jrSnap.size;
          console.log(`   ${dryRun ? '[DRY-RUN] would delete' : 'deleted'} ${jrSnap.size} join_request(s) from cell ${cellDoc.id}`);
        }
      }
      if (joinTotal === 0) console.log('   (no join_requests found via manual scan)');
    } else {
      throw indexErr; // re-throw unexpected errors
    }
  }
  summary['join_requests'] = joinTotal;
  console.log();

  // ── Final summary ─────────────────────────────────────────────────────────
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log(`║  PURGE COMPLETE${dryRun ? ' [DRY-RUN]' : ''}${' '.repeat(dryRun ? 37 : 45)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  User  : ${email}`);
  console.log(`  UID   : ${uid}\n`);
  console.log('  Records processed:');
  for (const [col, count] of Object.entries(summary)) {
    console.log(`    ${col.padEnd(32)} ${count}`);
  }
  if (dryRun) {
    console.log('\n  ⚠️   DRY-RUN complete — nothing was actually deleted.');
    console.log('       Re-run WITHOUT --dry-run to perform the purge.\n');
  } else {
    console.log(`\n  ✅  ${email} has been permanently removed from all collections.\n`);
  }

  process.exit(0);
})().catch(err => {
  console.error('\n❌  Fatal error during purge:\n', err);
  process.exit(1);
});
