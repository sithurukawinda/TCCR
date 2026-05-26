// Live promote function check — run with: node scripts/test-promote.js
require('dotenv').config({ path: '.env' });
const https = require('https');
const http  = require('http');

const API_KEY = process.env.FIREBASE_WEB_API_KEY;
const BASE    = 'http://localhost:3000/api/v1';
const AUTH    = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;

const req = (url, opts = {}, body = null) => new Promise((resolve, reject) => {
  const u    = new URL(url);
  const lib  = u.protocol === 'https:' ? https : http;
  const data = body ? JSON.stringify(body) : null;
  const options = {
    hostname: u.hostname,
    port:     u.port || (u.protocol === 'https:' ? 443 : 80),
    path:     u.pathname + u.search,
    method:   opts.method || 'GET',
    headers:  {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
      ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
    },
  };
  const r = lib.request(options, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      try { resolve({ code: res.statusCode, body: JSON.parse(d) }); }
      catch { resolve({ code: res.statusCode, body: d }); }
    });
  });
  r.on('error', reject);
  if (data) r.write(data);
  r.end();
});

const signin = (email, pass) =>
  req(AUTH, { method: 'POST' }, { email, password: pass, returnSecureToken: true });

const api = (method, path, token, body = null) =>
  req(`${BASE}${path}`, { method, headers: { Authorization: `Bearer ${token}` } }, body);

const ok    = code => code === 200 ? '✅' : '❌';
const roles = r  => (r.body.roles || []).join(', ') || '—';
const msg   = r  => r.body.message || (r.body.error ? `${r.body.error.code}: ${r.body.error.message}` : '') || '';

async function run() {
  console.log('=== SIGNING IN ALL SEED ACCOUNTS ===');
  const [SA, ADM, LDR, G12, S2] = await Promise.all([
    signin('superadmin@cmp.com', 'SuperAdmin@123'),
    signin('admin@cmp.com',      'Admin@12345'),
    signin('leader@cmp.com',     'Leader@12345'),
    signin('g12leader@cmp.com',  'G12Lead@123'),
    signin('student2@cmp.com',   'Student2@123'),
  ]);

  const sa  = { token: SA.body.idToken,  uid: SA.body.localId  };
  const adm = { token: ADM.body.idToken, uid: ADM.body.localId };
  const ldr = { token: LDR.body.idToken, uid: LDR.body.localId };
  const g12 = { token: G12.body.idToken, uid: G12.body.localId };
  const s2  = { token: S2.body.idToken,  uid: S2.body.localId  };

  console.log(`  super_admin uid : ${sa.uid}`);
  console.log(`  admin       uid : ${adm.uid}`);
  console.log(`  leader      uid : ${ldr.uid}`);
  console.log(`  g12         uid : ${g12.uid}`);
  console.log(`  student2    uid : ${s2.uid}\n`);

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           PROMOTE FUNCTION — LIVE SYSTEM CHECK            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  let r, fresh;

  // ── 1. Starting roles ────────────────────────────────────────────────────
  console.log('── 1. STARTING ROLES ───────────────────────────────────────────');
  r = await api('GET', '/me', sa.token);  console.log(`  super_admin : ${roles(r)}`);
  r = await api('GET', '/me', adm.token); console.log(`  admin       : ${roles(r)}`);
  r = await api('GET', '/me', ldr.token); console.log(`  leader      : ${roles(r)}`);
  r = await api('GET', '/me', g12.token); console.log(`  g12         : ${roles(r)}`);
  r = await api('GET', '/me', s2.token);  console.log(`  student2    : ${roles(r)}\n`);

  // ── 2. admin promotes student2 → leader ─────────────────────────────────
  console.log('── 2. HAPPY PATH — admin promotes student2 to leader ───────────');
  r = await api('POST', `/users/${s2.uid}/promote`, adm.token, { role: 'leader' });
  console.log(`  ${ok(r.code)}  admin → promote s2uid  {role:leader}    HTTP ${r.code}  ${msg(r)}`);
  fresh = (await signin('student2@cmp.com', 'Student2@123')).body.idToken;
  r = await api('GET', '/me', fresh);
  console.log(`       student2 roles after promote : ${roles(r)}\n`);

  // ── 3. Restore — demote student2 back from leader ────────────────────────
  console.log('── 3. RESTORE — remove leader role from student2 ───────────────');
  r = await api('POST', `/users/${s2.uid}/demote`, adm.token, { role: 'leader' });
  console.log(`  ${ok(r.code)}  admin → demote s2uid  {role:leader}     HTTP ${r.code}  ${msg(r)}\n`);

  // ── 4. super_admin promotes student2 → g12 ──────────────────────────────
  console.log('── 4. HAPPY PATH — super_admin promotes student2 to g12 ────────');
  r = await api('POST', `/users/${s2.uid}/promote`, sa.token, { role: 'g12' });
  console.log(`  ${ok(r.code)}  super_admin → promote s2uid  {role:g12}  HTTP ${r.code}  ${msg(r)}`);
  fresh = (await signin('student2@cmp.com', 'Student2@123')).body.idToken;
  r = await api('GET', '/me', fresh);
  console.log(`       student2 roles after promote : ${roles(r)}\n`);

  // ── 5. Restore ────────────────────────────────────────────────────────────
  console.log('── 5. RESTORE — remove g12 role from student2 ──────────────────');
  r = await api('POST', `/users/${s2.uid}/demote`, adm.token, { role: 'g12' });
  console.log(`  ${ok(r.code)}  admin → demote s2uid  {role:g12}        HTTP ${r.code}  ${msg(r)}\n`);

  // ── 6. g12 promotes student2 → leader ────────────────────────────────────
  console.log('── 6. HAPPY PATH — g12 promotes student2 to leader ─────────────');
  r = await api('POST', `/users/${s2.uid}/promote`, g12.token, { role: 'leader' });
  console.log(`  ${ok(r.code)}  g12 → promote s2uid  {role:leader}      HTTP ${r.code}  ${msg(r)}`);
  fresh = (await signin('student2@cmp.com', 'Student2@123')).body.idToken;
  r = await api('GET', '/me', fresh);
  console.log(`       student2 roles after promote : ${roles(r)}\n`);

  // ── 7. Restore ────────────────────────────────────────────────────────────
  console.log('── 7. RESTORE — remove leader role from student2 ───────────────');
  r = await api('POST', `/users/${s2.uid}/demote`, adm.token, { role: 'leader' });
  console.log(`  ${ok(r.code)}  admin → demote s2uid  {role:leader}     HTTP ${r.code}  ${msg(r)}\n`);

  // ── 8. leader promotes student2 → g12 ────────────────────────────────────
  console.log('── 8. HAPPY PATH — leader promotes student2 to g12 ─────────────');
  fresh = (await signin('leader@cmp.com', 'Leader@12345')).body.idToken;
  r = await api('POST', `/users/${s2.uid}/promote`, fresh, { role: 'g12' });
  console.log(`  ${ok(r.code)}  leader → promote s2uid  {role:g12}      HTTP ${r.code}  ${msg(r)}`);
  fresh = (await signin('student2@cmp.com', 'Student2@123')).body.idToken;
  r = await api('GET', '/me', fresh);
  console.log(`       student2 roles after promote : ${roles(r)}\n`);

  // ── 9. Restore ────────────────────────────────────────────────────────────
  console.log('── 9. RESTORE — remove g12 role from student2 ──────────────────');
  r = await api('POST', `/users/${s2.uid}/demote`, adm.token, { role: 'g12' });
  console.log(`  ${ok(r.code)}  admin → demote s2uid  {role:g12}        HTTP ${r.code}  ${msg(r)}\n`);

  // ── 10. Idempotent — promote role already held ───────────────────────────
  console.log('── 10. IDEMPOTENT — promote role already held ──────────────────');
  r = await api('POST', `/users/${ldr.uid}/promote`, adm.token, { role: 'leader' });
  console.log(`  ${ok(r.code)}  leader already has 'leader' → silent 200  HTTP ${r.code}  ${msg(r)}\n`);

  // ── 11. Guard rails ───────────────────────────────────────────────────────
  console.log('── 11. GUARD RAILS ─────────────────────────────────────────────');

  // Cannot promote yourself
  r = await api('POST', `/users/${adm.uid}/promote`, adm.token, { role: 'leader' });
  console.log(`  ${r.code === 403 ? '✅' : '❌'}  self-promote blocked                       HTTP ${r.code}  ${msg(r)}`);

  // leader cannot promote to 'leader' (only g12)
  fresh = (await signin('leader@cmp.com', 'Leader@12345')).body.idToken;
  r = await api('POST', `/users/${s2.uid}/promote`, fresh, { role: 'leader' });
  console.log(`  ${r.code === 403 ? '✅' : '❌'}  leader cannot promote to 'leader'          HTTP ${r.code}  ${msg(r)}`);

  // Cannot promote an admin account
  r = await api('POST', `/users/${adm.uid}/promote`, sa.token, { role: 'g12' });
  console.log(`  ${r.code === 403 ? '✅' : '❌'}  admin target is protected                  HTTP ${r.code}  ${msg(r)}`);

  // Target user not found
  r = await api('POST', `/users/nonexistent-uid-000/promote`, adm.token, { role: 'leader' });
  console.log(`  ${r.code === 404 ? '✅' : '❌'}  non-existent user → 404                    HTTP ${r.code}  ${msg(r)}`);

  // Missing role field — Zod
  r = await api('POST', `/users/${s2.uid}/promote`, adm.token, {});
  console.log(`  ${r.code === 400 ? '✅' : '❌'}  missing role field → 400                   HTTP ${r.code}  ${msg(r)}`);

  // Invalid role value — only leader / g12 allowed
  r = await api('POST', `/users/${s2.uid}/promote`, adm.token, { role: 'student' });
  console.log(`  ${r.code === 400 ? '✅' : '❌'}  invalid role 'student' → 400               HTTP ${r.code}  ${msg(r)}`);

  // No token — unauthenticated
  r = await req(`${BASE}/users/${s2.uid}/promote`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, { role: 'leader' });
  console.log(`  ${r.code === 401 ? '✅' : '❌'}  no token → 401                             HTTP ${r.code}  ${msg(r)}\n`);

  // ── 12. Final state ───────────────────────────────────────────────────────
  console.log('── 12. FINAL STATE (all restored) ──────────────────────────────');
  r = await api('GET', '/me', sa.token);  console.log(`  super_admin : ${roles(r)}`);
  r = await api('GET', '/me', adm.token); console.log(`  admin       : ${roles(r)}`);
  fresh = (await signin('leader@cmp.com',    'Leader@12345')).body.idToken;
  r = await api('GET', '/me', fresh);     console.log(`  leader      : ${roles(r)}`);
  fresh = (await signin('g12leader@cmp.com', 'G12Lead@123')).body.idToken;
  r = await api('GET', '/me', fresh);     console.log(`  g12         : ${roles(r)}`);
  fresh = (await signin('student2@cmp.com',  'Student2@123')).body.idToken;
  r = await api('GET', '/me', fresh);     console.log(`  student2    : ${roles(r)}\n`);

  console.log('════════════════════════════════════════════════════════════════');
}

run().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
