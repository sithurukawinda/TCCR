// Live demote function check — run with: node scripts/test-demote.js
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
const guard = code => code === 403 ? '✅' : '❌';
const roles = r => (r.body.roles || [r.body.role] || []).join(', ') || '—';
const msg   = r => r.body.message || (r.body.error ? `${r.body.error.code}: ${r.body.error.message}` : '') || '';

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
  console.log('║            DEMOTE FUNCTION — LIVE SYSTEM CHECK            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  let r, freshToken;

  // ── 1. Starting roles ────────────────────────────────────────────────────
  console.log('── 1. STARTING ROLES ───────────────────────────────────────────');
  r = await api('GET', '/me', sa.token);  console.log(`  super_admin : ${roles(r)}`);
  r = await api('GET', '/me', adm.token); console.log(`  admin       : ${roles(r)}`);
  r = await api('GET', '/me', ldr.token); console.log(`  leader      : ${roles(r)}`);
  r = await api('GET', '/me', g12.token); console.log(`  g12         : ${roles(r)}`);
  r = await api('GET', '/me', s2.token);  console.log(`  student2    : ${roles(r)}\n`);

  // ── 2. admin demotes g12leader [role=g12] ──────────────────────────────
  console.log('── 2. HAPPY PATH — admin demotes g12leader [role=g12] ──────────');
  r = await api('POST', `/users/${g12.uid}/demote`, adm.token, { role: 'g12' });
  console.log(`  ${ok(r.code)}  admin → demote g12uid  {role:g12}    HTTP ${r.code}  ${msg(r)}`);
  freshToken = (await signin('g12leader@cmp.com', 'G12Lead@123')).body.idToken;
  r = await api('GET', '/me', freshToken);
  console.log(`       g12 roles after demote : ${roles(r)}\n`);

  // ── 3. Restore g12 role ──────────────────────────────────────────────────
  console.log('── 3. RESTORE — admin promotes g12leader back to g12 ───────────');
  r = await api('POST', `/users/${g12.uid}/promote`, adm.token, { role: 'g12' });
  console.log(`  ${ok(r.code)}  admin → promote g12uid  {role:g12}   HTTP ${r.code}  ${msg(r)}\n`);

  // ── 4. super_admin demotes leader [role=leader] ─────────────────────────
  console.log('── 4. HAPPY PATH — super_admin demotes leader [role=leader] ────');
  r = await api('POST', `/users/${ldr.uid}/demote`, sa.token, { role: 'leader' });
  console.log(`  ${ok(r.code)}  super_admin → demote ldruid  {role:leader}   HTTP ${r.code}  ${msg(r)}`);
  freshToken = (await signin('leader@cmp.com', 'Leader@12345')).body.idToken;
  r = await api('GET', '/me', freshToken);
  console.log(`       leader roles after demote : ${roles(r)}\n`);

  // ── 5. Restore leader role ───────────────────────────────────────────────
  console.log('── 5. RESTORE — super_admin promotes leader back ────────────────');
  r = await api('POST', `/users/${ldr.uid}/promote`, sa.token, { role: 'leader' });
  console.log(`  ${ok(r.code)}  super_admin → promote ldruid  {role:leader}   HTTP ${r.code}  ${msg(r)}\n`);

  // ── 6. admin demotes student2 [role=student] ────────────────────────────
  console.log('── 6. HAPPY PATH — admin demotes student2 [role=student] ────────');
  r = await api('POST', `/users/${s2.uid}/demote`, adm.token, { role: 'student' });
  console.log(`  ${ok(r.code)}  admin → demote s2uid  {role:student}   HTTP ${r.code}  ${msg(r)}`);
  freshToken = (await signin('student2@cmp.com', 'Student2@123')).body.idToken;
  r = await api('GET', '/me', freshToken);
  console.log(`       student2 roles after demote : ${roles(r)}\n`);

  // ── 7. Restore student role ──────────────────────────────────────────────
  console.log('── 7. RESTORE — admin adds student role back to student2 ────────');
  // PATCH /users/:uid/roles expects { role, action: 'add'|'remove' }
  r = await api('PATCH', `/users/${s2.uid}/roles`, adm.token, { role: 'student', action: 'add' });
  console.log(`  ${ok(r.code)}  admin restores s2uid [role=student, action=add]   HTTP ${r.code}  ${msg(r)}\n`);

  // ── 8. Guard rails — forbidden scenarios ────────────────────────────────
  console.log('── 8. GUARD RAILS ───────────────────────────────────────────────');

  // Cannot demote yourself — admin tries to demote own 'student' role (which they don't have; tested as self-demote guard)
  // Use admin demoting themselves with a valid role value
  r = await api('POST', `/users/${adm.uid}/demote`, adm.token, { role: 'student' });
  console.log(`  ${r.code === 403 ? '✅' : '❌'}  self-demote blocked                     HTTP ${r.code}  ${msg(r)}`);

  // leader cannot demote 'student' (only allowed: g12)
  freshToken = (await signin('leader@cmp.com', 'Leader@12345')).body.idToken;
  r = await api('POST', `/users/${s2.uid}/demote`, freshToken, { role: 'student' });
  console.log(`  ${r.code === 403 ? '✅' : '❌'}  leader cannot demote 'student'          HTTP ${r.code}  ${msg(r)}`);

  // leader cannot demote 'leader' (only allowed: g12)
  r = await api('POST', `/users/${g12.uid}/demote`, freshToken, { role: 'leader' });
  console.log(`  ${r.code === 403 ? '✅' : '❌'}  leader cannot demote another 'leader'   HTTP ${r.code}  ${msg(r)}`);

  // g12 cannot demote another g12 (only allowed: leader)
  freshToken = (await signin('g12leader@cmp.com', 'G12Lead@123')).body.idToken;
  r = await api('POST', `/users/${ldr.uid}/demote`, freshToken, { role: 'g12' });
  console.log(`  ${r.code === 403 ? '✅' : '❌'}  g12 cannot demote 'g12'                HTTP ${r.code}  ${msg(r)}`);

  // admin/super_admin target is protected — try to demote super_admin with a valid role value
  r = await api('POST', `/users/${sa.uid}/demote`, adm.token, { role: 'student' });
  console.log(`  ${r.code === 403 ? '✅' : '❌'}  super_admin target is protected         HTTP ${r.code}  ${msg(r)}`);

  // Idempotent — demoting a role the user doesn't hold returns 200 silently
  r = await api('POST', `/users/${s2.uid}/demote`, adm.token, { role: 'leader' });
  console.log(`  ${r.code === 200 ? '✅' : '❌'}  idempotent: role not held → 200         HTTP ${r.code}  ${msg(r)}`);

  // Zod validation — missing body.role
  r = await api('POST', `/users/${s2.uid}/demote`, adm.token, {});
  console.log(`  ${r.code === 400 ? '✅' : '❌'}  missing role field → 400 Zod error      HTTP ${r.code}  ${msg(r)}`);

  // Invalid role value
  r = await api('POST', `/users/${s2.uid}/demote`, adm.token, { role: 'member' });
  console.log(`  ${r.code === 400 ? '✅' : '❌'}  invalid role 'member' → 400             HTTP ${r.code}  ${msg(r)}\n`);

  // ── 9. Final state — all roles restored ─────────────────────────────────
  console.log('── 9. FINAL STATE (all restored) ───────────────────────────────');
  r = await api('GET', '/me', sa.token);  console.log(`  super_admin : ${roles(r)}`);
  r = await api('GET', '/me', adm.token); console.log(`  admin       : ${roles(r)}`);
  freshToken = (await signin('leader@cmp.com',     'Leader@12345')).body.idToken;
  r = await api('GET', '/me', freshToken);  console.log(`  leader      : ${roles(r)}`);
  freshToken = (await signin('g12leader@cmp.com',  'G12Lead@123')).body.idToken;
  r = await api('GET', '/me', freshToken);  console.log(`  g12         : ${roles(r)}`);
  freshToken = (await signin('student2@cmp.com',   'Student2@123')).body.idToken;
  r = await api('GET', '/me', freshToken);  console.log(`  student2    : ${roles(r)}\n`);

  console.log('════════════════════════════════════════════════════════════════');
}

run().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
