#!/usr/bin/env node
/**
 * Newman Runner — Cell Service only.
 *
 * What this script does:
 *   1. Verifies gateway + emulators are reachable
 *   2. Clears Firestore emulator data (clean slate)
 *   3. Re-seeds the base test accounts via seed-emulator.js
 *   4. Signs in superAdmin, admin, and student2 programmatically
 *   5. Runs only the "🏘 V2 — Cell Service" folder from the Postman collection
 *   6. Generates CLI + HTML report at postman/newman-cell-report.html
 *
 * Prerequisites (all must be running):
 *   - Firebase emulators:  npx firebase emulators:start
 *   - All services:        docker-compose -f docker-compose.yml -f docker-compose.local.yml up
 *
 * Usage:
 *   node scripts/newman-cell-service.js
 */
'use strict';

const path       = require('path');
const { execSync } = require('child_process');
const newman     = require('newman');

const AUTH_EMULATOR    = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const API_KEY          = 'fake-key';
const BASE_URL         = 'http://localhost:3000/api/v1';
const FIREBASE_PROJECT = 'e-learning-f4209';

// ── helpers ───────────────────────────────────────────────────────────────────

async function signIn(email, password) {
  const url = `${AUTH_EMULATOR}/accounts:signInWithPassword?key=${API_KEY}`;
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sign-in failed for ${email}: ${body}`);
  }
  const d = await res.json();
  return { token: d.idToken, uid: d.localId };
}

function envVar(key, value) {
  return { key, value: value || '' };
}

async function clearEmulators() {
  const fsUrl = `http://localhost:8080/emulator/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;
  const fsRes = await fetch(fsUrl, { method: 'DELETE' });
  if (!fsRes.ok && fsRes.status !== 404) throw new Error(`Firestore clear failed: ${fsRes.status}`);
}

async function seedAccounts() {
  execSync('node scripts/seed-emulator.js', {
    cwd:   path.join(__dirname, '..'),
    stdio: 'pipe',
  });
  execSync('node scripts/seed-v2-roles.js', {
    cwd:   path.join(__dirname, '..'),
    stdio: 'pipe',
  });
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║     Newman — Cell Service Test Runner                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // 1. Verify gateway is reachable
  try {
    const hc = await fetch('http://localhost:3000/healthz');
    if (!hc.ok) throw new Error(`status ${hc.status}`);
    console.log('✓  Gateway is up');
  } catch (e) {
    console.error(`❌  Gateway not reachable: ${e.message}`);
    console.error('    Start services first:');
    console.error('    docker-compose -f docker-compose.yml -f docker-compose.local.yml up');
    process.exit(1);
  }

  // 2. Verify cell-service is reachable
  try {
    const hc = await fetch('http://localhost:3009/healthz');
    if (!hc.ok) throw new Error(`status ${hc.status}`);
    console.log('✓  Cell-service is up');
  } catch (e) {
    console.error(`❌  Cell-service not reachable on :3009 — is it included in Docker Compose?`);
    process.exit(1);
  }

  // 3. Verify emulators are reachable
  try {
    const hc = await fetch('http://localhost:8080');
    console.log('✓  Firestore emulator is up');
  } catch (e) {
    console.error(`❌  Firestore emulator not reachable on :8080`);
    console.error('    Run: npx firebase emulators:start');
    process.exit(1);
  }

  // 4. Clear emulator data and re-seed
  console.log('✓  Clearing emulator data...');
  try {
    await clearEmulators();
    console.log('✓  Emulator data cleared');
  } catch (e) {
    console.error(`❌  Could not clear emulators: ${e.message}`);
    process.exit(1);
  }

  console.log('✓  Seeding test accounts...');
  try {
    await seedAccounts();
    console.log('✓  Seed accounts ready');
  } catch (e) {
    console.error(`❌  Seeding failed: ${e.message}`);
    process.exit(1);
  }

  // 5. Sign in required accounts
  console.log('✓  Signing in accounts...');
  let sa, admin, student2, leader, g12;
  try {
    [sa, admin, student2, leader, g12] = await Promise.all([
      signIn('superadmin@cmp.com', 'SuperAdmin@123'),
      signIn('admin@cmp.com',      'Admin@12345'),
      signIn('student2@cmp.com',   'Student2@123'),
      signIn('leader@cmp.com',     'Leader@12345'),
      signIn('g12leader@cmp.com',  'G12Lead@123'),
    ]);
    console.log('✓  Tokens ready');
    console.log(`   super_admin: ${sa.uid}`);
    console.log(`   admin:       ${admin.uid}`);
    console.log(`   student2:    ${student2.uid}`);
    console.log(`   leader:      ${leader.uid}`);
    console.log(`   g12:         ${g12.uid}`);
  } catch (e) {
    console.error(`❌  Auth failed: ${e.message}`);
    process.exit(1);
  }

  // 6. Verify services accept emulator tokens
  try {
    const probe = await fetch(`${BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${sa.token}` },
    });
    if (probe.status === 401) {
      console.error('\n❌  Services are rejecting emulator tokens.');
      console.error('    Start with the local Firebase overlay:');
      console.error('    docker-compose -f docker-compose.yml -f docker-compose.local.yml up --build\n');
      process.exit(1);
    }
    console.log('✓  Emulator tokens accepted by services');
  } catch (_) {}

  console.log('\n▶  Running Newman — Cell Service folder...\n');

  newman.run({
    collection:  path.join(__dirname, '../postman/CMP_Backend.postman_collection.json'),
    environment: path.join(__dirname, '../postman/CMP_Local.postman_environment.json'),
    workingDir:  path.join(__dirname, '../postman'),
    folder:      '🏘 V2 — Cell Service',
    envVar: [
      envVar('baseUrl',        BASE_URL),
      envVar('authBaseUrl',    AUTH_EMULATOR),
      envVar('firebaseWebApiKey', API_KEY),
      // Inject tokens directly so Sign In folder is not needed
      envVar('superAdminToken', sa.token),
      envVar('superAdminId',    sa.uid),
      envVar('adminToken',      admin.token),
      envVar('adminId',         admin.uid),
      envVar('student2Token',   student2.token),
      envVar('student2Id',      student2.uid),
      envVar('leaderToken',     leader.token),
      envVar('leaderId',        leader.uid),
      envVar('g12Token',        g12.token),
      envVar('g12Id',           g12.uid),
    ],
    delayRequest:   400,
    timeoutRequest: 30000,
    color:          'on',
    reporters:      ['cli', 'htmlextra'],
    reporter: {
      htmlextra: {
        export:            path.join(__dirname, '../postman/newman-cell-report.html'),
        title:             'TCCR Backend — Cell Service Test Report',
        browserTitle:      'Cell Service Tests',
        showMarkdownLinks: true,
        omitHeaders:       true,
      },
    },
  }, (err, summary) => {
    if (err) {
      console.error('\n❌  Newman runner error:', err.message);
      process.exit(1);
    }

    const { stats } = summary.run;
    const passed  = stats.assertions.total - stats.assertions.failed;
    const failed  = stats.assertions.failed;
    const reqFail = stats.requests.failed;

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║               Cell Service — Final Summary               ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  Requests :  ${String(stats.requests.total).padEnd(6)}  (${reqFail} errored)`.padEnd(59) + '║');
    console.log(`║  Assertions: ${String(stats.assertions.total).padEnd(6)}  passed: ${passed}   failed: ${failed}`.padEnd(59) + '║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    if (failed === 0 && reqFail === 0) {
      console.log('║  ✅  ALL CELL SERVICE TESTS PASSED                       ║');
    } else {
      console.log(`║  ❌  ${failed + reqFail} ISSUE(S) FOUND — check report above         ║`);
    }
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('\n📄  HTML report: postman/newman-cell-report.html\n');

    if (failed > 0 || reqFail > 0) process.exitCode = 1;
  });
}

main().catch(e => {
  console.error('\n❌ Unexpected error:', e.message);
  process.exit(1);
});
