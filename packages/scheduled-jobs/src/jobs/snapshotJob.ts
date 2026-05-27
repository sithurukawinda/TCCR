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
  const [yearStr, weekStr] = weekKey.split('-W');
  const year = Number(yearStr);
  const week = Number(weekStr);
  const jan4   = new Date(Date.UTC(year, 0, 4));
  const weekDay = jan4.getUTCDay() || 7;
  const monday  = new Date(jan4.getTime() - (weekDay - 1) * 86400000 + (week - 1) * 7 * 86400000);
  return monday.toISOString().split('T')[0];
}

// ── Types ─────────────────────────────────────────────────────────────────────

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
  date:               string;
  didMeet:            boolean;
  cellType:           string;
  attendance:         AttendanceEntry[];
  additionalVisitors: number;
  childrenCount:      number;
  satisfactionRate:   number;
  voided:             boolean;
  filledByUid:        string;
  createdAt:          string;
}

interface SnapshotMetrics {
  cellCount:             number;
  activeCells:           number;
  reportCount:           number;
  attendance:            { present: number; absent: number; visitors: number; children: number; newAttendees: number };
  meetingTypeBreakdown:  { g12: number; care: number; children: number; outreach: number };
  memberGrowth:          number;
  participationRate:     number;
  averageSatisfaction:   number;
  participationByLeader: Array<{ leaderUid: string; leaderName: string; averageAttendance: number; cellCount: number }>;
}

function emptyMetrics(): SnapshotMetrics {
  return {
    cellCount:             0,
    activeCells:           0,
    reportCount:           0,
    attendance:            { present: 0, absent: 0, visitors: 0, children: 0, newAttendees: 0 },
    meetingTypeBreakdown:  { g12: 0, care: 0, children: 0, outreach: 0 },
    memberGrowth:          0,
    participationRate:     0,
    averageSatisfaction:   0,
    participationByLeader: [],
  };
}

/**
 * Aggregate a single cell report's stats into a metrics bucket.
 * Skips reports where the cell didn't meet or the report is voided.
 */
function aggregateReport(metrics: SnapshotMetrics, report: CellReportDoc): void {
  if (!report.didMeet || report.voided) return;

  metrics.reportCount++;

  for (const a of report.attendance ?? []) {
    if (a.status === 'present' || a.status === 'new') metrics.attendance.present++;
    else if (a.status === 'absent') metrics.attendance.absent++;
    if (a.isNew) metrics.attendance.newAttendees++;
  }
  metrics.attendance.visitors  += report.additionalVisitors ?? 0;
  metrics.attendance.children  += report.childrenCount ?? 0;

  const mt = report.cellType as keyof typeof metrics.meetingTypeBreakdown;
  if (mt in metrics.meetingTypeBreakdown) {
    metrics.meetingTypeBreakdown[mt]++;
  }
}

function finalize(m: SnapshotMetrics, satisfactionSum: number): void {
  m.participationRate   = m.cellCount > 0 ? m.activeCells / m.cellCount : 0;
  m.averageSatisfaction = m.reportCount > 0
    ? Math.round((satisfactionSum / m.reportCount) * 10) / 10
    : 0;
}

// ── Scope-bucket helpers ──────────────────────────────────────────────────────

/**
 * A full set of metrics buckets for one "dimension" (org, per-leader, per-g12).
 * The optional `cellType` suffix makes it a filtered view (e.g. "org|care").
 */
interface ScopeBuckets {
  org:     SnapshotMetrics;
  leaders: Map<string, SnapshotMetrics>;
  g12:     Map<string, SnapshotMetrics>;
  satisfactionSums: { org: number; leaders: Map<string, number>; g12: Map<string, number> };
}

function emptyScopeBuckets(): ScopeBuckets {
  return {
    org:     emptyMetrics(),
    leaders: new Map(),
    g12:     new Map(),
    satisfactionSums: { org: 0, leaders: new Map(), g12: new Map() },
  };
}

function ensureLeaderG12(buckets: ScopeBuckets, leaderUid: string, g12Uid: string): void {
  if (!buckets.leaders.has(leaderUid)) buckets.leaders.set(leaderUid, emptyMetrics());
  if (!buckets.g12.has(g12Uid))        buckets.g12.set(g12Uid,        emptyMetrics());
}

function addCellToBuckets(buckets: ScopeBuckets, cell: CellGroupDoc): void {
  buckets.org.cellCount++;
  buckets.leaders.get(cell.leaderUid)!.cellCount++;
  buckets.g12.get(cell.g12LeaderUid)!.cellCount++;
}

function addReportToBuckets(
  buckets:    ScopeBuckets,
  cell:       CellGroupDoc,
  report:     CellReportDoc,
  isFirstReport: boolean,
): void {
  aggregateReport(buckets.org,                            report);
  aggregateReport(buckets.leaders.get(cell.leaderUid)!,  report);
  aggregateReport(buckets.g12.get(cell.g12LeaderUid)!,   report);

  if (isFirstReport) {
    buckets.org.activeCells++;
    buckets.leaders.get(cell.leaderUid)!.activeCells++;
    buckets.g12.get(cell.g12LeaderUid)!.activeCells++;
  }

  if (report.didMeet && !report.voided && report.satisfactionRate) {
    buckets.satisfactionSums.org += report.satisfactionRate;
    buckets.satisfactionSums.leaders.set(
      cell.leaderUid,
      (buckets.satisfactionSums.leaders.get(cell.leaderUid) ?? 0) + report.satisfactionRate,
    );
    buckets.satisfactionSums.g12.set(
      cell.g12LeaderUid,
      (buckets.satisfactionSums.g12.get(cell.g12LeaderUid) ?? 0) + report.satisfactionRate,
    );
  }
}

function finalizeBuckets(buckets: ScopeBuckets, leaderMetrics: Map<string, SnapshotMetrics>): void {
  finalize(buckets.org, buckets.satisfactionSums.org);

  for (const [uid, m] of buckets.leaders) {
    finalize(m, buckets.satisfactionSums.leaders.get(uid) ?? 0);
    m.participationByLeader = [{
      leaderUid:         uid,
      leaderName:        uid,
      averageAttendance: m.reportCount > 0 ? m.attendance.present / m.reportCount : 0,
      cellCount:         m.cellCount,
    }];
  }

  for (const [uid, m] of buckets.g12) {
    finalize(m, buckets.satisfactionSums.g12.get(uid) ?? 0);
    m.participationByLeader = [...leaderMetrics.entries()]
      .filter(([, lm]) => lm.cellCount > 0)
      .map(([luid, lm]) => ({
        leaderUid:         luid,
        leaderName:        luid,
        averageAttendance: lm.reportCount > 0 ? lm.attendance.present / lm.reportCount : 0,
        cellCount:         lm.cellCount,
      }));
  }

  buckets.org.participationByLeader = [...leaderMetrics.entries()].map(([luid, lm]) => ({
    leaderUid:         luid,
    leaderName:        luid,
    averageAttendance: lm.reportCount > 0 ? lm.attendance.present / lm.reportCount : 0,
    cellCount:         lm.cellCount,
  }));
}

function writeBucketsToFirestore(
  batch:        FirebaseFirestore.WriteBatch,
  col:          FirebaseFirestore.CollectionReference,
  buckets:      ScopeBuckets,
  periodKey:    string,
  nowIso:       string,
  scopePrefix:  string,   // e.g. '' for base or '|care' for cellType dimension
): void {
  batch.set(col.doc(`org${scopePrefix}_${periodKey}`), {
    scope: `org${scopePrefix}`, periodKey, metrics: buckets.org, computedAt: nowIso,
  });

  for (const [uid, m] of buckets.leaders) {
    batch.set(col.doc(`leader:${uid}${scopePrefix}_${periodKey}`), {
      scope: `leader:${uid}${scopePrefix}`, periodKey, metrics: m, computedAt: nowIso,
    });
  }

  for (const [uid, m] of buckets.g12) {
    batch.set(col.doc(`g12:${uid}${scopePrefix}_${periodKey}`), {
      scope: `g12:${uid}${scopePrefix}`, periodKey, metrics: m, computedAt: nowIso,
    });
  }
}

// ── Main snapshot job ─────────────────────────────────────────────────────────

const CELL_TYPES = ['care', 'children', 'outreach', 'g12'] as const;

export async function runSnapshotJob(): Promise<void> {
  const db        = getFirestore();
  const nowIso    = new Date().toISOString();
  const periodKey = getISOWeekKey(new Date());
  const weekStart = weekStartIso(periodKey);
  const weekEnd   = new Date(Date.parse(weekStart) + 7 * 86400000).toISOString().split('T')[0];

  logger.info({ periodKey, weekStart, weekEnd }, 'Snapshot job starting');

  // ── 1. Load all active cell groups ────────────────────────────────────────

  const cellSnap = await db.collection('cell_groups')
    .where('state', '==', 'active')
    .get();

  if (cellSnap.empty) {
    logger.info('Snapshot job: no active cells, skipping');
    return;
  }

  // ── 2. Initialise scope buckets ───────────────────────────────────────────
  // Base buckets (all cell types) + one set of buckets per cell type dimension

  const base = emptyScopeBuckets();
  const byType: Record<string, ScopeBuckets> = {};
  for (const ct of CELL_TYPES) byType[ct] = emptyScopeBuckets();

  // Pre-populate leader/g12 maps so every cell is represented
  for (const cellDoc of cellSnap.docs) {
    const cell = cellDoc.data() as CellGroupDoc;
    ensureLeaderG12(base, cell.leaderUid, cell.g12LeaderUid);
    ensureLeaderG12(byType[cell.type as typeof CELL_TYPES[number]] ?? byType['care'],
      cell.leaderUid, cell.g12LeaderUid);
    // Ensure the cellType bucket even when we hit an unexpected type
    if (!(cell.type in byType)) {
      // unknown type — skip type-specific bucket, still counted in base
    }
  }

  // ── 3. Iterate cells → load reports → aggregate ───────────────────────────

  for (const cellDoc of cellSnap.docs) {
    const cell    = cellDoc.data() as CellGroupDoc;
    const cellType = cell.type as typeof CELL_TYPES[number];

    addCellToBuckets(base, cell);
    if (cellType in byType) addCellToBuckets(byType[cellType], cell);

    const reportsSnap = await db.collection('cell_groups')
      .doc(cellDoc.id)
      .collection('cell_reports')
      .where('date', '>=', weekStart)
      .where('date', '<',  weekEnd)
      .where('voided', '==', false)
      .get();

    let firstReport = true;
    for (const reportDoc of reportsSnap.docs) {
      const report = reportDoc.data() as CellReportDoc;

      addReportToBuckets(base, cell, report, firstReport);
      if (cellType in byType) addReportToBuckets(byType[cellType], cell, report, firstReport);
      firstReport = false;
    }
  }

  // ── 4. Finalize participation rates + satisfaction averages ───────────────

  finalizeBuckets(base, base.leaders);
  for (const ct of CELL_TYPES) finalizeBuckets(byType[ct], byType[ct].leaders);

  // ── 5. Write all snapshots in one Firestore batch ─────────────────────────

  const snapshotCol = db.collection('analytics_snapshots');
  const batch       = db.batch();

  // Base snapshots (no cellType filter)
  writeBucketsToFirestore(batch, snapshotCol, base, periodKey, nowIso, '');

  // CellType-dimension snapshots (e.g. scope = "org|care")
  for (const ct of CELL_TYPES) {
    writeBucketsToFirestore(batch, snapshotCol, byType[ct], periodKey, nowIso, `|${ct}`);
  }

  await batch.commit();

  logger.info({
    periodKey,
    orgCells:        base.org.cellCount,
    orgReports:      base.org.reportCount,
    leaderScopes:    base.leaders.size,
    g12Scopes:       base.g12.size,
    cellTypeScopes:  CELL_TYPES.length,
  }, 'Snapshot job complete');
}
