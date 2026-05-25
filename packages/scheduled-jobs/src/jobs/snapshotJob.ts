import { getFirestore } from 'firebase-admin/firestore';
import { logger }        from '@shared/logger';

// ── Period helpers ────────────────────────────────────────────────────────────

function getISOWeekKey(date: Date): string {
  const d      = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum   = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function weekStartIso(weekKey: string): string {
  // weekKey = "YYYY-WNN"
  const [yearStr, weekStr] = weekKey.split('-W');
  const year = Number(yearStr);
  const week = Number(weekStr);
  // Jan 4 is always in week 1
  const jan4   = new Date(Date.UTC(year, 0, 4));
  const weekDay = jan4.getUTCDay() || 7;
  const monday  = new Date(jan4.getTime() - (weekDay - 1) * 86400000 + (week - 1) * 7 * 86400000);
  return monday.toISOString().split('T')[0];
}

// ── Snapshot generation ───────────────────────────────────────────────────────

interface CellGroupDoc {
  leaderUid:    string;
  g12LeaderUid: string;
  members:      string[];
  memberCount:  number;
  state:        string;
  type:         string;
}

interface AttendanceEntry {
  status: 'present' | 'absent' | 'new';
  isNew:  boolean;
}

interface CellReportDoc {
  date:                string;
  didMeet:             boolean;
  cellType:            string;
  attendance:          AttendanceEntry[];
  additionalVisitors:  number;
  childrenCount:       number;
  satisfactionRate:    number;
  voided:              boolean;
  filledByUid:         string;
  createdAt:           string;
}

interface SnapshotMetrics {
  cellCount:            number;
  activeCells:          number;
  reportCount:          number;
  attendance:           { present: number; absent: number; visitors: number; children: number; newAttendees: number };
  meetingTypeBreakdown: { g12: number; care: number; children: number; outreach: number };
  memberGrowth:         number;
  participationRate:    number;
  averageSatisfaction:  number;
  participationByLeader: Array<{ leaderUid: string; leaderName: string; averageAttendance: number; cellCount: number }>;
}

function emptyMetrics(): SnapshotMetrics {
  return {
    cellCount:            0,
    activeCells:          0,
    reportCount:          0,
    attendance:           { present: 0, absent: 0, visitors: 0, children: 0, newAttendees: 0 },
    meetingTypeBreakdown: { g12: 0, care: 0, children: 0, outreach: 0 },
    memberGrowth:         0,
    participationRate:    0,
    averageSatisfaction:  0,
    participationByLeader: [],
  };
}

function aggregateReport(metrics: SnapshotMetrics, report: CellReportDoc): void {
  if (!report.didMeet || report.voided) return;

  metrics.reportCount++;

  // Attendance
  for (const a of report.attendance ?? []) {
    if (a.status === 'present' || a.status === 'new') metrics.attendance.present++;
    else if (a.status === 'absent') metrics.attendance.absent++;
    if (a.isNew) metrics.attendance.newAttendees++;
  }
  metrics.attendance.visitors  += report.additionalVisitors ?? 0;
  metrics.attendance.children  += report.childrenCount ?? 0;

  // Meeting type
  const mt = report.cellType as keyof typeof metrics.meetingTypeBreakdown;
  if (mt in metrics.meetingTypeBreakdown) {
    metrics.meetingTypeBreakdown[mt]++;
  }
}

export async function runSnapshotJob(): Promise<void> {
  const db         = getFirestore();
  const nowIso     = new Date().toISOString();
  const periodKey  = getISOWeekKey(new Date());
  const weekStart  = weekStartIso(periodKey);
  const weekEnd    = new Date(Date.parse(weekStart) + 7 * 86400000).toISOString().split('T')[0];

  logger.info({ periodKey, weekStart, weekEnd }, 'Snapshot job starting');

  // ── 1. Get all active cell groups ─────────────────────────────────────────

  const cellSnap = await db.collection('cell_groups')
    .where('state', '==', 'active')
    .get();

  if (cellSnap.empty) {
    logger.info('Snapshot job: no active cells, skipping');
    return;
  }

  // ── 2. Build scope buckets ────────────────────────────────────────────────
  // Each cell contributes to 3 scopes: its leader, its G12 leader, and org

  const orgMetrics                              = emptyMetrics();
  const leaderMetrics: Map<string, SnapshotMetrics> = new Map();
  const g12Metrics:    Map<string, SnapshotMetrics> = new Map();

  const leaderCellCounts: Map<string, number> = new Map();
  const activeCellsPerLeader: Map<string, Set<string>> = new Map();
  const satisfactionSums: { org: number; leaders: Map<string, number>; g12: Map<string, number> } = {
    org: 0, leaders: new Map(), g12: new Map(),
  };

  for (const cellDoc of cellSnap.docs) {
    const cell = cellDoc.data() as CellGroupDoc;
    orgMetrics.cellCount++;

    if (!leaderMetrics.has(cell.leaderUid)) leaderMetrics.set(cell.leaderUid, emptyMetrics());
    if (!g12Metrics.has(cell.g12LeaderUid))  g12Metrics.set(cell.g12LeaderUid,  emptyMetrics());

    leaderMetrics.get(cell.leaderUid)!.cellCount++;
    g12Metrics.get(cell.g12LeaderUid)!.cellCount++;
    leaderCellCounts.set(cell.leaderUid, (leaderCellCounts.get(cell.leaderUid) ?? 0) + 1);

    // ── 3. Get reports for this cell in the current week ──────────────────

    const reportsSnap = await db.collection('cell_groups')
      .doc(cellDoc.id)
      .collection('cell_reports')
      .where('date', '>=', weekStart)
      .where('date', '<',  weekEnd)
      .where('voided', '==', false)
      .get();

    if (reportsSnap.size > 0) {
      orgMetrics.activeCells++;
      leaderMetrics.get(cell.leaderUid)!.activeCells++;
      g12Metrics.get(cell.g12LeaderUid)!.activeCells++;

      if (!activeCellsPerLeader.has(cell.leaderUid)) {
        activeCellsPerLeader.set(cell.leaderUid, new Set());
      }
      activeCellsPerLeader.get(cell.leaderUid)!.add(cellDoc.id);
    }

    for (const reportDoc of reportsSnap.docs) {
      const report = reportDoc.data() as CellReportDoc;
      aggregateReport(orgMetrics, report);
      aggregateReport(leaderMetrics.get(cell.leaderUid)!, report);
      aggregateReport(g12Metrics.get(cell.g12LeaderUid)!, report);

      // Track satisfaction for averaging
      if (report.didMeet && !report.voided && report.satisfactionRate) {
        satisfactionSums.org += report.satisfactionRate;
        satisfactionSums.leaders.set(cell.leaderUid,
          (satisfactionSums.leaders.get(cell.leaderUid) ?? 0) + report.satisfactionRate);
        satisfactionSums.g12.set(cell.g12LeaderUid,
          (satisfactionSums.g12.get(cell.g12LeaderUid) ?? 0) + report.satisfactionRate);
      }
    }
  }

  // ── 4. Compute participation rates + satisfaction averages ───────────────

  finalize(orgMetrics, satisfactionSums.org);

  for (const [uid, m] of leaderMetrics) {
    finalize(m, satisfactionSums.leaders.get(uid) ?? 0);
    m.participationByLeader = [{
      leaderUid:         uid,
      leaderName:        uid, // real name lookup would need user-service call
      averageAttendance: m.reportCount > 0 ? m.attendance.present / m.reportCount : 0,
      cellCount:         m.cellCount,
    }];
  }

  for (const [uid, m] of g12Metrics) {
    finalize(m, satisfactionSums.g12.get(uid) ?? 0);
    // Build per-leader participation for G12 scope
    m.participationByLeader = [...leaderMetrics.entries()]
      .filter(([_luid, lm]) => lm.cellCount > 0)
      .map(([luid, lm]) => ({
        leaderUid:         luid,
        leaderName:        luid,
        averageAttendance: lm.reportCount > 0 ? lm.attendance.present / lm.reportCount : 0,
        cellCount:         lm.cellCount,
      }));
    void uid;
  }

  orgMetrics.participationByLeader = [...leaderMetrics.entries()].map(([luid, lm]) => ({
    leaderUid:         luid,
    leaderName:        luid,
    averageAttendance: lm.reportCount > 0 ? lm.attendance.present / lm.reportCount : 0,
    cellCount:         lm.cellCount,
  }));

  // ── 5. Write snapshots ────────────────────────────────────────────────────

  const snapshotCol = db.collection('analytics_snapshots');
  const batch       = db.batch();

  // Org snapshot
  batch.set(snapshotCol.doc(`org_${periodKey}`), {
    scope: 'org', periodKey, metrics: orgMetrics, computedAt: nowIso,
  });

  // Leader snapshots
  for (const [uid, m] of leaderMetrics) {
    batch.set(snapshotCol.doc(`leader:${uid}_${periodKey}`), {
      scope: `leader:${uid}`, periodKey, metrics: m, computedAt: nowIso,
    });
  }

  // G12 snapshots
  for (const [uid, m] of g12Metrics) {
    batch.set(snapshotCol.doc(`g12:${uid}_${periodKey}`), {
      scope: `g12:${uid}`, periodKey, metrics: m, computedAt: nowIso,
    });
  }

  await batch.commit();

  logger.info({
    periodKey,
    orgCells:    orgMetrics.cellCount,
    orgReports:  orgMetrics.reportCount,
    leaderScopes: leaderMetrics.size,
    g12Scopes:    g12Metrics.size,
  }, 'Snapshot job complete');
}

function finalize(m: SnapshotMetrics, satisfactionSum: number): void {
  m.participationRate = m.cellCount > 0 ? m.activeCells / m.cellCount : 0;
  m.averageSatisfaction = m.reportCount > 0
    ? Math.round((satisfactionSum / m.reportCount) * 10) / 10
    : 0;
}
