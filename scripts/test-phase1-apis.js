'use strict';
/**
 * Phase 1 Live API Tests — runs against the running local stack.
 *
 * Tests:
 *   1. POST /auth/register        → creates active Member (not pending student)
 *   2. POST /auth/register        → 409 on duplicate email
 *   3. POST /auth/register        → 400 on missing fields
 *   4. GET  /me                   → returns roles[], preferredLanguage
 *   5. PATCH /me                  → updates preferredLanguage
 *   6. POST /auth/register        → 400 on weak password
 *
 * Prerequisites: all services running (bash scripts/start.sh)
 * Usage: node scripts/test-phase1-apis.js
 */

const BASE    = 'http://localhost:3000/api/v1';
const API_KEY = 'AIzaSyDudm6GFhmqLd6zVW0igYL0myX-vN9H5-0';
const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;

const pass = [];
const fail = [];

function ok(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅  ${label}`);
    pass.push(label);
  } else {
    console.log(`  ❌  ${label}${detail ? ' — ' + detail : ''}`);
    fail.push(label);
  }
}

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

async function signIn(email, password) {
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const d = await res.json();
  if (!d.idToken) throw new Error(`Sign-in failed for ${email}: ${JSON.stringify(d)}`);
  return d.idToken;
}

const TEST_EMAIL = `phase1test_${Date.now()}@tccr.test`;
const TEST_PASS  = 'TestPass@2026';

(async () => {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  Phase 1 Live API Tests');
  console.log('══════════════════════════════════════════════════\n');

  // ── Test 1: Register → active member ─────────────────────────────────────
  console.log('── 1. POST /auth/register ───────────────────────');

  const reg = await api('POST', '/auth/register', {
    firstName: 'Phase1',
    lastName:  'Tester',
    email:     TEST_EMAIL,
    password:  TEST_PASS,
  });

  ok('Returns 201 Created', reg.status === 201, `got ${reg.status}`);

  // ── Test 2: Get profile → verify member fields ────────────────────────────
  console.log('\n── 2. GET /me → verify member profile ───────────');

  let token;
  try {
    token = await signIn(TEST_EMAIL, TEST_PASS);
    ok('Sign-in succeeds (member is immediately active)', !!token);
  } catch (e) {
    ok('Sign-in succeeds (member is immediately active)', false, e.message);
    console.log('\n  ⚠  Cannot continue without token\n');
    process.exit(1);
  }

  const me = await api('GET', '/me', null, token);
  ok('GET /me returns 200',                             me.status === 200, `got ${me.status}`);
  ok('roles is an array',                               Array.isArray(me.data?.roles));
  ok('roles contains "member"',                         me.data?.roles?.includes('member'));
  ok('roles does NOT contain "student"',                !me.data?.roles?.includes('student'));
  ok('status is "approved" (not pending_approval)',     me.data?.status === 'approved', `got "${me.data?.status}"`);
  ok('preferredLanguage defaults to "en"',              me.data?.preferredLanguage === 'en', `got "${me.data?.preferredLanguage}"`);
  ok('V2: no pending_approval status on new user',      me.data?.status !== 'pending_approval');

  console.log('\n  Response snapshot:');
  console.log(`    uid:               ${me.data?.uid}`);
  console.log(`    email:             ${me.data?.email}`);
  console.log(`    roles:             ${JSON.stringify(me.data?.roles)}`);
  console.log(`    status:            ${me.data?.status}`);
  console.log(`    preferredLanguage: ${me.data?.preferredLanguage}`);

  // ── Test 3: PATCH /me → update preferredLanguage ─────────────────────────
  console.log('\n── 3. PATCH /me → update preferredLanguage ─────');

  const patch = await api('PATCH', '/me', { preferredLanguage: 'si' }, token);
  ok('PATCH /me returns 200',                         patch.status === 200, `got ${patch.status}`);
  ok('preferredLanguage updated to "si"',              patch.data?.preferredLanguage === 'si', `got "${patch.data?.preferredLanguage}"`);
  ok('firstName unchanged after preferredLanguage patch', patch.data?.firstName === 'Phase1');

  // ── Test 4: Duplicate email → 409 ────────────────────────────────────────
  console.log('\n── 4. POST /auth/register → duplicate email ─────');

  const dup = await api('POST', '/auth/register', {
    firstName: 'Dup', lastName: 'User',
    email: TEST_EMAIL, password: TEST_PASS,
  });
  ok('Returns 409 EMAIL_EXISTS',      dup.status === 409,              `got ${dup.status}`);
  ok('Error code is EMAIL_EXISTS',    dup.data?.error?.code === 'EMAIL_EXISTS');

  // ── Test 5: Missing required field → 400 ─────────────────────────────────
  console.log('\n── 5. POST /auth/register → missing password ────');

  const missing = await api('POST', '/auth/register', {
    firstName: 'No', lastName: 'Pass', email: 'nopass@test.com',
  });
  ok('Returns 400 validation error',  missing.status === 400, `got ${missing.status}`);

  // ── Test 6: Weak password → 400 ──────────────────────────────────────────
  console.log('\n── 6. POST /auth/register → weak password ───────');

  const weak = await api('POST', '/auth/register', {
    firstName: 'Weak', lastName: 'Pass',
    email: `weak_${Date.now()}@test.com`, password: '123',
  });
  ok('Returns 400 for weak password', weak.status === 400, `got ${weak.status}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const total = pass.length + fail.length;
  console.log('\n══════════════════════════════════════════════════');
  console.log(`  ✅ Passed: ${pass.length}   ❌ Failed: ${fail.length}   Total: ${total}`);
  if (fail.length) {
    console.log('\n  Failed:');
    fail.forEach(f => console.log(`    ✗ ${f}`));
  }
  console.log('══════════════════════════════════════════════════\n');
  process.exit(fail.length > 0 ? 1 : 0);
})();
