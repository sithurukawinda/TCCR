'use strict';
/**
 * Restore all seed accounts to their original state before running Newman against online Firebase.
 * Run this once before each Newman session: node scripts/_restore-seeds.js
 */
const admin = require('firebase-admin');
const fs    = require('fs');
const path  = require('path');

const env = {};
fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m) env[m[1]] = m[2].replace(/\\n/g, '\n');
});

admin.initializeApp({
  credential: admin.credential.cert({
    projectId:   env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey:  env.FIREBASE_PRIVATE_KEY,
  }),
});

const db = admin.firestore();

const seeds = [
  { email: 'superadmin@cmp.com', password: 'SuperAdmin@123', role: 'super_admin', roles: ['super_admin'] },
  { email: 'admin@cmp.com',      password: 'Admin@12345',    role: 'admin',       roles: ['admin'] },
  { email: 'student1@cmp.com',   password: 'Student1@123',   role: 'student',     roles: ['member', 'student'], status: 'approved' },
  { email: 'student2@cmp.com',   password: 'Student2@123',   role: 'student',     roles: ['member', 'student'], status: 'approved' },
  { email: 'leader@cmp.com',     password: 'Leader@12345',   role: 'leader',      roles: ['member', 'leader']  },
  { email: 'g12leader@cmp.com',  password: 'G12Lead@123',    role: 'g12',         roles: ['member', 'g12']     },
];

async function run() {
  const uidMap = {};

  for (const seed of seeds) {
    try {
      const u = await admin.auth().getUserByEmail(seed.email);
      uidMap[seed.email] = u.uid;

      // 1. Fix Firebase Auth — do NOT include password here so Firebase does NOT
      //    revoke refresh tokens. Token revocation breaks the Newman online run because
      //    tokens signed in by newman-run-online.js become invalid mid-collection.
      //    Password is only reset if the account is actually disabled (can't sign in).
      const updatePayload = { disabled: false };
      if (u.disabled) updatePayload.password = seed.password; // only reset pw if locked out
      await admin.auth().updateUser(u.uid, updatePayload);
      await admin.auth().setCustomUserClaims(u.uid, { role: seed.role, roles: seed.roles });

      // 2. Fix Firestore document (only fields that tests might corrupt)
      const updates = {
        role:      seed.role,
        roles:     seed.roles,
        deletedAt: null,
      };
      if (seed.status) updates.status = seed.status;
      await db.collection('users').doc(u.uid).update(updates);

      console.log(`✅  ${seed.email} restored`);
    } catch (e) {
      console.error(`❌  ${seed.email}: ${e.message}`);
    }
  }

  // 3. Delete any pending/approved/rejected role_requests left over from previous Newman runs.
  //    Without this, POST /role-requests returns 409 ROLE_REQUEST_PENDING on the next run.
  const studentEmails = ['student1@cmp.com', 'student2@cmp.com'];
  const studentUids   = studentEmails.map(e => uidMap[e]).filter(Boolean);
  if (studentUids.length > 0) {
    try {
      const snap = await db.collection('role_requests')
        .where('requesterUid', 'in', studentUids)
        .get();
      if (!snap.empty) {
        const batch = db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log(`🧹  Deleted ${snap.size} stale role_request(s) for seed students`);
      }
    } catch (e) {
      console.error(`⚠️   role_requests cleanup failed: ${e.message}`);
    }
  }

  // 4. Delete any master account left from a previous Newman master-management test run.
  //    Without this, POST /master/invite returns 409 MASTER_ALREADY_EXISTS on the next run.
  try {
    const masterSnap = await db.collection('users')
      .where('roles', 'array-contains', 'master')
      .get();
    if (!masterSnap.empty) {
      const seedEmails = new Set(seeds.map(s => s.email));
      const masterDocs = masterSnap.docs.filter(d => !seedEmails.has(d.data().email));
      if (masterDocs.length > 0) {
        const batch = db.batch();
        for (const doc of masterDocs) {
          batch.delete(doc.ref);
          try { await admin.auth().deleteUser(doc.id); } catch (_) { /* already gone */ }
        }
        await batch.commit();
        console.log(`🧹  Deleted ${masterDocs.length} stale master user(s) from previous test run`);
      }
    }
  } catch (e) {
    console.error(`⚠️   master cleanup failed: ${e.message}`);
  }
}

run().finally(() => process.exit(0));
