/**
 * Deploy Firestore composite indexes to the online project
 * using the service account (bypasses Firebase CLI login requirement).
 *
 * Usage: node scripts/deploy-indexes.js NewPrivateKey.json
 */
'use strict';

const path    = require('path');
const admin   = require('firebase-admin');
const indexes = require('../firestore.indexes.json');

const keyPath = process.argv[2];
if (!keyPath) { console.error('Usage: node scripts/deploy-indexes.js <serviceAccount.json>'); process.exit(1); }

const sa = require(path.resolve(keyPath));
const app = admin.initializeApp({ credential: admin.credential.cert(sa) });

async function getToken() {
  const token = await app.options.credential.getAccessToken();
  return token.access_token;
}

async function createIndex(token, collectionGroup, queryScope, fields) {
  const url = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/collectionGroups/${collectionGroup}/indexes`;
  const body = { queryScope, fields: fields.map(f => ({
    fieldPath: f.fieldPath,
    ...(f.order ? { order: f.order } : {}),
    ...(f.arrayConfig ? { arrayConfig: f.arrayConfig } : {}),
  }))};

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (res.ok) return { ok: true, name: data.name };
  if (data.error?.status === 'ALREADY_EXISTS') return { ok: true, skipped: true };
  return { ok: false, error: data.error?.message ?? JSON.stringify(data) };
}

async function run() {
  console.log(`\nDeploying ${indexes.indexes.length} Firestore indexes to ${sa.project_id}…\n`);

  const token = await getToken();
  let created = 0, skipped = 0, failed = 0;

  for (const idx of indexes.indexes) {
    const fields = idx.fields.map(f => f.fieldPath).join(', ');
    const label  = `${idx.collectionGroup} [${fields}]`;
    const result = await createIndex(token, idx.collectionGroup, idx.queryScope, idx.fields);

    if (result.skipped) {
      console.log(`⬜  ${label}  (already exists)`);
      skipped++;
    } else if (result.ok) {
      console.log(`✅  ${label}`);
      created++;
    } else {
      console.log(`❌  ${label}  — ${result.error}`);
      failed++;
    }
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`Created : ${created}`);
  console.log(`Skipped : ${skipped}  (already existed)`);
  console.log(`Failed  : ${failed}`);
  console.log(`\nIndexes are building in the background.`);
  console.log(`They will be ready in 1–3 minutes.`);
  console.log(`Check status: https://console.firebase.google.com/project/${sa.project_id}/firestore/indexes\n`);
  process.exit(failed ? 1 : 0);
}

run().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
