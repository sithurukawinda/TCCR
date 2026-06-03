'use strict';
/**
 * Search users collection by first or last name (case-insensitive contains).
 * Usage: node scripts/_search-by-name.js sapna
 */
const fs    = require('fs');
const path  = require('path');
const admin = require('firebase-admin');

const query = (process.argv[2] || '').toLowerCase();
if (!query) { console.error('Usage: node scripts/_search-by-name.js <name>'); process.exit(1); }

function loadEnv(filename) {
  const p = path.resolve(__dirname, '..', filename);
  if (!fs.existsSync(p)) return {};
  const r = {};
  fs.readFileSync(p, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*"?(.*?)"?\s*$/);
    if (m) r[m[1]] = m[2].replace(/\\n/g, '\n');
  });
  return r;
}
const env = { ...loadEnv('.env.local'), ...loadEnv('.env') };

admin.initializeApp({
  credential: admin.credential.cert({
    projectId:   env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey:  env.FIREBASE_PRIVATE_KEY,
  }),
});

const db = admin.firestore();

(async () => {
  console.log(`\nSearching users where name contains "${query}"...\n`);

  const snap = await db.collection('users').get();
  const results = [];

  snap.forEach(doc => {
    const d = doc.data();
    const fn = (d.firstName || '').toLowerCase();
    const ln = (d.lastName  || '').toLowerCase();
    if (fn.includes(query) || ln.includes(query)) {
      results.push({
        uid:       doc.id,
        firstName: d.firstName || '',
        lastName:  d.lastName  || '',
        email:     d.email     || '',
        roles:     d.roles     || [],
        status:    d.status    || '',
        deletedAt: d.deletedAt || null,
        createdAt: d.createdAt ? (d.createdAt.toDate ? d.createdAt.toDate().toISOString() : String(d.createdAt)) : '',
      });
    }
  });

  if (results.length === 0) {
    console.log(`No users found with name containing "${query}".`);
  } else {
    console.log(`Found ${results.length} user(s):\n`);
    results.forEach((u, i) => {
      console.log(`[${i + 1}]`);
      console.log('  UID      :', u.uid);
      console.log('  Name     :', u.firstName, u.lastName);
      console.log('  Email    :', u.email);
      console.log('  Roles    :', u.roles.join(', ') || '(none)');
      console.log('  Status   :', u.status);
      console.log('  Active   :', u.deletedAt ? 'DELETED' : 'Yes');
      console.log('  Created  :', u.createdAt);
      console.log();
    });
  }

  process.exit(0);
})().catch(err => { console.error('Error:', err.message); process.exit(1); });
