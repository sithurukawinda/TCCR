'use strict';
/**
 * trigger-snapshot.js
 *
 * Manually runs the analytics snapshotJob against the online Firebase instance.
 * Use this when analytics data shows all zeros because the scheduled-jobs weekly
 * snapshot hasn't fired yet (runs automatically Sunday 02:00 UTC).
 *
 * Prerequisites:
 *   - .env.local must have valid FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *   - Services do NOT need to be running — this hits Firestore directly
 *
 * Usage:
 *   node scripts/trigger-snapshot.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const admin = require('firebase-admin');

const {
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
  FIREBASE_STORAGE_BUCKET,
} = process.env;

if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  console.error('❌  Missing Firebase credentials in .env.local');
  console.error('   Requires: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId:   FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey:  FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
  storageBucket: FIREBASE_STORAGE_BUCKET,
});

// ── Helpers (copied from snapshotJob.ts) ─────────────────────────────────────

function getISOWeekKey(date) {
  const d      = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum   = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function weekStartIso(weekKey) {
  const [yearStr, weekStr] = weekKey.split('-W');
  const year = Number(yearStr);
  const week = Number(weekStr);
  const jan4    = new Date(Date.UTC(year, 0, 4));
  const weekDay = jan4.getUTCDay() || 7;
  const monday  = new Date(jan4.getTime() - (weekDay - 1) * 86400000 + (week - 1) * 7 * 86400000);
  return monday.toISOString().split('T')[0];
}

function emptyMetrics() {
  return {
    cellCount: 0, activeCells: 0, reportCount: 0,
    attendance: { present: 0, absent: 0, visitors: 0, children: 0, newAttendees: 0 },
    meetingTypeBreakdown: { g12: 0, care: 0, children: 0, outreach: 0 },
    participationRate: 0, averageSatisfaction: 0,
    participationByLeader: [],
  };
}

function aggregateReport(metrics, report) {
  if (report.voided) return;
  metrics.reportCount++;
  if (report.attendance) {
    for (const entry of report.attendance) {
      if (entry.status === 'present') metrics.attendance.present++;
      else if (entry.status === 'absent') metrics.attendance.absent++;
      if (entry.isNew) metrics.attendance.newAttendees++;
    }
  }
  metrics.attendance.visitors  += report.additionalVisitors  || 0;
  metrics.attendance.children  += report.childrenCount       || 0;
  const type = report.cellType;
  if (type && metrics.meetingTypeBreakdown[type] !== undefined) {
    metrics.meetingTypeBreakdown[type]++;
  }
}

function finalize(m, satisfactionSum) {
  m.participationRate    = m.cellCount > 0 ? m.activeCells / m.cellCount : 0;
  m.averageSatisfaction  = m.reportCount > 0
    ? Math.round((satisfactionSum / m.reportCount) * 10) / 10
    : 0;
}

// ── Main snapshot logic ───────────────────────────────────────────────────────

async function runSnapshot() {
  const db        = admin.firestore();
  const now       = new Date();
  const periodKey = getISOWeekKey(now);
  const weekStart = weekStartIso(periodKey);
  const weekEnd   = new Date(new Date(weekStart).getTime() + 7 * 86400000).toISOString().split('T')[0];

  console.log(`\n📊  Running analytics snapshot for week ${periodKey} (${weekStart} → ${weekEnd})\n`);

  // Load all active cell groups
  const cellsSnap = await db.collection('cell_groups')
    .where('state', '==', 'active')
    .get();

  if (cellsSnap.empty) {
    console.warn('⚠️  No active cell groups found — nothing to snapshot.');
    process.exit(0);
  }

  console.log(`   Found ${cellsSnap.size} active cell group(s)`);

  const orgMetrics    = emptyMetrics();
  const leaderMetrics = new Map();
  const g12Metrics    = new Map();
  const leaderCellCounts  = new Map();
  const activeCellsPerLeader = new Map();
  const satisfactionSums  = { org: 0, leaders: new Map(), g12: new Map() };

  orgMetrics.cellCount = cellsSnap.size;

  for (const cellDoc of cellsSnap.docs) {
    const cell = cellDoc.data();

    if (!leaderMetrics.has(cell.leaderUid))  leaderMetrics.set(cell.leaderUid,  emptyMetrics());
    if (!g12Metrics.has(cell.g12LeaderUid))  g12Metrics.set(cell.g12LeaderUid,  emptyMetrics());

    leaderMetrics.get(cell.leaderUid).cellCount++;
    g12Metrics.get(cell.g12LeaderUid).cellCount++;
    leaderCellCounts.set(cell.leaderUid, (leaderCellCounts.get(cell.leaderUid) ?? 0) + 1);

    // Load reports for this cell in the current week
    const reportsSnap = await db
      .collection('cell_groups').doc(cellDoc.id)
      .collection('cell_reports')
      .where('date', '>=', weekStart)
      .where('date', '<', weekEnd)
      .get();

    if (reportsSnap.size > 0) {
      orgMetrics.activeCells++;
      leaderMetrics.get(cell.leaderUid).activeCells++;
      g12Metrics.get(cell.g12LeaderUid).activeCells++;

      if (!activeCellsPerLeader.has(cell.leaderUid)) {
        activeCellsPerLeader.set(cell.leaderUid, new Set());
      }
      activeCellsPerLeader.get(cell.leaderUid).add(cellDoc.id);
    }

    for (const rDoc of reportsSnap.docs) {
      const report = rDoc.data();
      aggregateReport(orgMetrics,    report);
      aggregateReport(leaderMetrics.get(cell.leaderUid),  report);
      aggregateReport(g12Metrics.get(cell.g12LeaderUid),  report);

      if (report.satisfactionRate) {
        satisfactionSums.org += report.satisfactionRate;
        satisfactionSums.leaders.set(cell.leaderUid,
          (satisfactionSums.leaders.get(cell.leaderUid) ?? 0) + report.satisfactionRate);
        satisfactionSums.g12.set(cell.g12LeaderUid,
          (satisfactionSums.g12.get(cell.g12LeaderUid) ?? 0) + report.satisfactionRate);
      }
    }
  }

  // Finalize participation rates + satisfaction
  finalize(orgMetrics, satisfactionSums.org);
  for (const [uid, m] of leaderMetrics) finalize(m, satisfactionSums.leaders.get(uid) ?? 0);
  for (const [uid, m] of g12Metrics)    finalize(m, satisfactionSums.g12.get(uid)    ?? 0);

  // Build org participationByLeader table
  for (const [luid, m] of leaderMetrics) {
    orgMetrics.participationByLeader.push({
      leaderUid: luid, leaderName: '',
      averageAttendance: m.attendance.present + m.attendance.absent > 0
        ? Math.round((m.attendance.present / (m.attendance.present + m.attendance.absent)) * 100)
        : 0,
      cellCount: leaderCellCounts.get(luid) ?? 0,
    });
  }

  const nowIso = now.toISOString();
  const batch  = db.batch();

  // Write org snapshot
  batch.set(
    db.collection('analytics_snapshots').doc(`org_${periodKey}`),
    { scope: 'org', periodKey, metrics: orgMetrics, computedAt: nowIso },
  );

  // Write leader snapshots
  for (const [uid, m] of leaderMetrics) {
    batch.set(
      db.collection('analytics_snapshots').doc(`leader:${uid}_${periodKey}`),
      { scope: `leader:${uid}`, periodKey, metrics: m, computedAt: nowIso },
    );
  }

  // Write g12 snapshots
  for (const [uid, m] of g12Metrics) {
    batch.set(
      db.collection('analytics_snapshots').doc(`g12:${uid}_${periodKey}`),
      { scope: `g12:${uid}`, periodKey, metrics: m, computedAt: nowIso },
    );
  }

  await batch.commit();

  console.log(`\n✅  Snapshot written for ${periodKey}`);
  console.log(`   org: ${orgMetrics.cellCount} cells, ${orgMetrics.activeCells} active, ${orgMetrics.reportCount} reports`);
  console.log(`   leader scopes: ${leaderMetrics.size}`);
  console.log(`   g12 scopes:    ${g12Metrics.size}`);

  if (g12Metrics.size === 0) {
    console.warn('\n⚠️  No g12 snapshots written — no cell groups have a g12LeaderUid set.');
    console.warn('   Assign a G12 leader to each cell group for analytics to populate.');
  }
}

runSnapshot()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌  Snapshot failed:', err.message);
    process.exit(1);
  });
