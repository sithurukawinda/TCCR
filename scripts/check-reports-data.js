#!/usr/bin/env node
'use strict';
const fetch = (...a) => import('node-fetch').then(({default:f})=>f(...a));

const API_KEY = 'AIzaSyDudm6GFhmqLd6zVW0igYL0myX-vN9H5-0';
const AUTH    = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
const BASE    = 'http://localhost:3000/api/v1';

async function signIn(email, pass) {
  const r = await fetch(AUTH, { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ email, password: pass, returnSecureToken: true }) });
  const d = await r.json();
  return d.idToken;
}

async function get(token, path) {
  const r = await fetch(BASE+path, { headers:{ Authorization:'Bearer '+token } });
  return r.json();
}

async function run() {
  const g12Token   = await signIn('g12leader@cmp.com', 'G12Lead@123');
  const adminToken = await signIn('admin@cmp.com',     'Admin@12345');

  // All reports May 2026
  const reports = await get(g12Token, '/cells/network/reports?month=2026-05&limit=200');
  const items   = reports.items || [];
  console.log('Total reports in May 2026:', items.length);
  console.log('');

  // All cells
  const cellsData  = await get(g12Token, '/cells?limit=100');
  const allCells   = cellsData.items || [];
  const cellMap    = Object.fromEntries(allCells.map(c => [c.id, c]));

  // All leaders
  const leadersData = await get(adminToken, '/users?role=leader&limit=100');
  const allLeaders  = leadersData.items || [];
  const leaderMap   = Object.fromEntries(allLeaders.map(l => [l.uid, l.firstName+' '+l.lastName]));

  // Cells with reports
  const cellReports = {};
  items.forEach(r => {
    if (!cellReports[r.cellId]) cellReports[r.cellId] = { name: r.cellName, type: r.cellType, count: 0, leaderUid: null };
    cellReports[r.cellId].count++;
    cellReports[r.cellId].leaderUid = cellMap[r.cellId]?.leaderUid;
  });

  console.log('=== CELLS WITH REPORTS IN MAY 2026 ===');
  Object.entries(cellReports).forEach(([cid, info]) => {
    const leaderName = leaderMap[info.leaderUid] || info.leaderUid || '?';
    console.log(`  Cell: "${info.name}" | type: ${info.type} | reports: ${info.count} | leader: ${leaderName} | leaderUid: ${info.leaderUid}`);
  });

  console.log('');
  console.log('=== ALL CELLS + LEADERS ===');
  allCells.forEach(c => {
    const hasReports = !!cellReports[c.id];
    const lName = leaderMap[c.leaderUid] || 'unknown';
    console.log(`  ${hasReports?'✅':'⬜'} "${c.name}" | type: ${c.type} | leader: ${lName} | leaderUid: ${c.leaderUid}`);
  });

  console.log('');
  console.log('=== FILTER TEST: leaderUid per leader ===');
  const uniqueLeaders = [...new Set(allCells.map(c=>c.leaderUid))];
  for (const luid of uniqueLeaders) {
    const r2 = await get(g12Token, `/cells/network/reports?month=2026-05&leaderUid=${luid}&limit=200`);
    const cnt = (r2.items||[]).length;
    console.log(`  leaderUid=${leaderMap[luid]||luid?.slice(0,10)} → ${cnt} reports`);
  }
}
run().catch(console.error);
