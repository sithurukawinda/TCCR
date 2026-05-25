'use strict';
/**
 * Deploy Firestore composite indexes using credentials from .env.local
 * Usage: node scripts/deploy-indexes-env.js
 */
const fs      = require('fs');
const path    = require('path');
const admin   = require('firebase-admin');
const indexes = require('../firestore.indexes.json');

const env = {};
fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m) env[m[1]] = m[2].replace(/\\n/g, '\n');
});

const app = admin.initializeApp({
  credential: admin.credential.cert({
    projectId:   env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey:  env.FIREBASE_PRIVATE_KEY,
  }),
});

async function run() {
  const projectId = env.FIREBASE_PROJECT_ID;
  console.log(`\nDeploying ${indexes.indexes.length} Firestore indexes to ${projectId}…\n`);

  const token = (await app.options.credential.getAccessToken()).access_token;
  let created = 0, skipped = 0, failed = 0;

  for (const idx of indexes.indexes) {
    const label = `${idx.collectionGroup} [${idx.fields.map(f => f.fieldPath).join(', ')}]`;
    const url   = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/collectionGroups/${idx.collectionGroup}/indexes`;
    const body  = { queryScope: idx.queryScope, fields: idx.fields.map(f => ({
      fieldPath: f.fieldPath,
      ...(f.order ? { order: f.order } : {}),
      ...(f.arrayConfig ? { arrayConfig: f.arrayConfig } : {}),
    }))};

    const res  = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();

    if (res.ok)                              { console.log(`✅  ${label}`); created++; }
    else if (data.error?.status === 'ALREADY_EXISTS') { console.log(`⬜  ${label}  (already exists)`); skipped++; }
    else                                     { console.log(`❌  ${label}  — ${data.error?.message}`); failed++; }
  }

  console.log(`\n──────────────────────────────────────────`);
  console.log(`Created : ${created}  |  Skipped : ${skipped}  |  Failed : ${failed}`);
  console.log(`\nIndexes build in background — ready in 1–3 minutes.`);
  console.log(`Status: https://console.firebase.google.com/project/${projectId}/firestore/indexes\n`);
  process.exit(failed ? 1 : 0);
}

run().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
