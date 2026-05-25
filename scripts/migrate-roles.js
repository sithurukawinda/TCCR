/**
 * One-time migration: backfill `roles` array on every user.
 *
 * Applies to the LIVE online Firebase project (not the emulator).
 * Safe to re-run — already-migrated users are skipped.
 *
 * Usage:
 *   node scripts/migrate-roles.js path/to/serviceAccount.json
 *
 * Or set GOOGLE_APPLICATION_CREDENTIALS and run without an argument:
 *   node scripts/migrate-roles.js
 *
 * What it does:
 *   1. Lists every Firebase Auth user in batches of 1 000
 *   2. Reads their current `role` custom claim
 *   3. If `roles` claim is already set → skips
 *   4. Sets custom claim `roles: [role]`  (preserves existing `role`)
 *   5. Updates the Firestore `users` document to add the `roles` field
 */

const admin = require('firebase-admin');

// ── Credentials ──────────────────────────────────────────────────────────────
const serviceAccountPath = process.argv[2];

if (serviceAccountPath) {
  const serviceAccount = require(require('path').resolve(serviceAccountPath));
  admin.initializeApp({
    credential:  admin.credential.cert(serviceAccount),
    projectId:   serviceAccount.project_id,
  });
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  admin.initializeApp();
} else {
  console.error('ERROR: Provide a service account JSON path as the first argument,');
  console.error('       or set GOOGLE_APPLICATION_CREDENTIALS environment variable.');
  process.exit(1);
}

const auth = admin.auth();
const db   = admin.firestore();

// ── Migration ─────────────────────────────────────────────────────────────────
async function migrate() {
  console.log('\nMigrating users — adding roles[] field…\n');

  let pageToken;
  let total    = 0;
  let skipped  = 0;
  let updated  = 0;
  let noDoc    = 0;

  do {
    const result = await auth.listUsers(1000, pageToken);
    pageToken = result.pageToken;

    for (const user of result.users) {
      total++;
      const claims = user.customClaims ?? {};
      const role   = claims.role;

      if (!role) {
        console.log(`  SKIP (no role claim)  ${user.email ?? user.uid}`);
        skipped++;
        continue;
      }

      if (Array.isArray(claims.roles)) {
        console.log(`  SKIP (already has roles)  ${user.email ?? user.uid}`);
        skipped++;
        continue;
      }

      // Determine roles array — single-role for all existing users
      // (promoted admins will get dual roles going forward via PromoteToAdminUseCase)
      const roles = [role];

      // Update Firebase Auth custom claims
      await auth.setCustomUserClaims(user.uid, { ...claims, roles });

      // Update Firestore users document (best-effort — doc may not exist for some users)
      const ref  = db.collection('users').doc(user.uid);
      const snap = await ref.get();

      if (snap.exists) {
        await ref.update({ roles, updatedAt: new Date().toISOString() });
        console.log(`  ✓  ${role.padEnd(12)} ${user.email ?? user.uid}`);
        updated++;
      } else {
        console.log(`  ✓  claims updated, no Firestore doc  ${user.email ?? user.uid}`);
        noDoc++;
        updated++;
      }
    }
  } while (pageToken);

  console.log('\n──────────────────────────────────────────');
  console.log(`Total users  : ${total}`);
  console.log(`Updated      : ${updated}`);
  console.log(`Skipped      : ${skipped}`);
  console.log(`No Firestore doc : ${noDoc}`);
  console.log('\nMigration complete.');
  console.log('Note: users must sign out and back in for new token claims to take effect.');
  process.exit(0);
}

migrate().catch(e => {
  console.error('\nMigration FAILED:', e.message);
  process.exit(1);
});
