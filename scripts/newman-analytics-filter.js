#!/usr/bin/env node
/**
 * Run only the Analytics Service folder via Newman against local Docker stack.
 * Signs in first to inject fresh tokens, then runs the 21 analytics requests.
 *
 * Prerequisites: docker-compose up (services running against online Firebase)
 * Usage: node scripts/newman-analytics-filter.js
 */
'use strict';

const newman   = require('newman');
const path     = require('path');
const fetch    = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const API_KEY  = 'AIzaSyDudm6GFhmqLd6zVW0igYL0myX-vN9H5-0';
const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
const BASE_URL = 'http://localhost:3000/api/v1';

async function signIn(email, password) {
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!data.idToken) throw new Error(`Sign-in failed for ${email}: ${JSON.stringify(data)}`);
  return { token: data.idToken, uid: data.localId };
}

async function run() {
  console.log('✓  Signing in seed accounts...');

  const [admin, g12, leader] = await Promise.all([
    signIn('admin@cmp.com',      'Admin@12345'),
    signIn('g12leader@cmp.com',  'G12Lead@123'),
    signIn('leader@cmp.com',     'Leader@12345'),
  ]);

  console.log(`✓  adminId  : ${admin.uid}`);
  console.log(`✓  g12Id    : ${g12.uid}`);
  console.log(`✓  leaderId : ${leader.uid}`);
  console.log('');

  const envVars = [
    { key: 'baseUrl',     value: BASE_URL,      enabled: true },
    { key: 'adminToken',  value: admin.token,   enabled: true },
    { key: 'adminId',     value: admin.uid,     enabled: true },
    { key: 'g12Token',    value: g12.token,     enabled: true },
    { key: 'g12Id',       value: g12.uid,       enabled: true },
    { key: 'leaderToken', value: leader.token,  enabled: true },
    { key: 'leaderId',    value: leader.uid,    enabled: true },
  ];

  newman.run({
    collection:  path.join(__dirname, '../postman/CMP_Backend.postman_collection.json'),
    environment: { id: 'analytics-filter-env', name: 'Analytics Filter Env', values: envVars },
    folder:      '📊 V2 — Analytics Service',
    delayRequest: 300,
    reporters:   ['cli', 'htmlextra'],
    reporter: {
      htmlextra: { export: path.join(__dirname, '../postman/newman-analytics-filter-report.html') },
    },
  }, (err, summary) => {
    if (err) { console.error(err); process.exit(1); }

    const { stats } = summary.run;
    const passed = stats.assertions.total - stats.assertions.failed;
    console.log('');
    console.log('╔══════════════════════════════════════╗');
    console.log('║      Analytics Filter — Summary      ║');
    console.log('╠══════════════════════════════════════╣');
    console.log(`║  Requests  : ${String(stats.requests.total).padEnd(24)}║`);
    console.log(`║  Assertions: ${String(stats.assertions.total).padEnd(24)}║`);
    console.log(`║  Passed    : ${String(passed).padEnd(24)}║`);
    console.log(`║  Failed    : ${String(stats.assertions.failed).padEnd(24)}║`);
    console.log('╚══════════════════════════════════════╝');
    console.log('');
    console.log('📄  HTML report → postman/newman-analytics-filter-report.html');

    if (stats.assertions.failed > 0) process.exit(1);
  });
}

run().catch(err => { console.error(err); process.exit(1); });
