#!/usr/bin/env node
'use strict';
require('dotenv').config();

const API_KEY  = process.env.FIREBASE_WEB_API_KEY;
const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
const BASE     = 'http://localhost:3000/api/v1';

let pass = 0, fail = 0;

function check(desc, expected, actual, body = '') {
  if (actual === expected) {
    console.log(`✅ PASS [${actual}] — ${desc}`);
    pass++;
  } else {
    console.log(`❌ FAIL [${actual} expected ${expected}] — ${desc}`);
    if (body) console.log(`   Body: ${body}`);
    fail++;
  }
}

async function signIn(email, password) {
  const r = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const d = await r.json();
  if (!d.idToken) throw new Error(`Sign in failed for ${email}: ${JSON.stringify(d)}`);
  return { token: d.idToken, uid: d.localId };
}

async function api(method, path, token) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = r.status !== 204 ? await r.text() : '';
  return { status: r.status, body };
}

(async () => {
  console.log('Signing in...');
  const sa    = await signIn('superadmin@cmp.com',  'SuperAdmin@123');
  const admin = await signIn('admin@cmp.com',        'Admin@12345');
  const stu   = await signIn('student2@cmp.com',     'Student2@123');

  console.log(`superAdminUID : ${sa.uid}`);
  console.log(`studentUID    : ${stu.uid}`);
  console.log('\n━━━━ MASTER ENDPOINT TESTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // T1 — list before grant
  let r = await api('GET', '/master/users', sa.token);
  check('GET /master/users [super_admin] before grant', 200, r.status);

  // T2 — grant master to student
  r = await api('POST', `/master/grant/${stu.uid}`, sa.token);
  check('POST /master/grant/:uid [super_admin]', 200, r.status, r.body);

  // T3 — list after grant (expect total=1)
  r = await api('GET', '/master/users', sa.token);
  const total3 = JSON.parse(r.body).total;
  if (r.status === 200 && total3 === 1) {
    console.log(`✅ PASS [200, total=${total3}] — GET /master/users after grant shows 1 master`); pass++;
  } else {
    console.log(`❌ FAIL [HTTP ${r.status}, total=${total3} expected 1] — GET /master/users after grant`);
    console.log(`   Body: ${r.body}`); fail++;
  }

  // T4 — revoke master from student
  r = await api('DELETE', `/master/revoke/${stu.uid}`, sa.token);
  check('DELETE /master/revoke/:uid [super_admin]', 200, r.status, r.body);

  // T5 — list after revoke (expect total=0)
  r = await api('GET', '/master/users', sa.token);
  const total5 = JSON.parse(r.body).total;
  if (r.status === 200 && total5 === 0) {
    console.log(`✅ PASS [200, total=${total5}] — GET /master/users after revoke shows 0 masters`); pass++;
  } else {
    console.log(`❌ FAIL [HTTP ${r.status}, total=${total5} expected 0] — GET /master/users after revoke`);
    fail++;
  }

  // T6 — admin blocked from list
  r = await api('GET', '/master/users', admin.token);
  check('GET /master/users [admin] — blocked', 403, r.status);

  // T7 — student blocked from list
  r = await api('GET', '/master/users', stu.token);
  check('GET /master/users [student] — blocked', 403, r.status);

  // T8 — admin blocked from grant
  r = await api('POST', `/master/grant/${stu.uid}`, admin.token);
  check('POST /master/grant/:uid [admin] — blocked', 403, r.status);

  // T9 — super_admin self-grant blocked
  r = await api('POST', `/master/grant/${sa.uid}`, sa.token);
  check('POST /master/grant/self [super_admin] — self-grant blocked', 403, r.status, r.body);

  // T10 — super_admin accesses super-admin-only endpoint
  r = await api('GET', '/super-admin/admins', sa.token);
  check('GET /super-admin/admins [super_admin]', 200, r.status);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Results: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error(e.message); process.exit(1); });
