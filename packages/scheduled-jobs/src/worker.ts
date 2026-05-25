import { initFirebaseAdmin } from '@shared/firebase';
import { logger }            from '@shared/logger';
import { config }            from './config';
import { runBatchSweep }     from './jobs/batchSweepJob';
import { runSemesterSweep }  from './jobs/semesterSweepJob';
import { runSnapshotJob }    from './jobs/snapshotJob';

initFirebaseAdmin();

// ── Job runner helpers ────────────────────────────────────────────────────────

function safeRun(name: string, fn: () => Promise<void>): void {
  fn().catch((err: unknown) => {
    logger.error({ err, job: name }, `${name} failed`);
  });
}

// ── Batch Sweep — every N minutes ─────────────────────────────────────────────

setInterval(() => {
  safeRun('batchSweep', runBatchSweep);
}, config.batchSweepIntervalMs);

// Run once on startup to catch any missed windows
safeRun('batchSweep', runBatchSweep);

// ── Semester Sweep — check hourly, run when conditions met ───────────────────

let lastSemesterSweepDate = '';

setInterval(() => {
  const now     = new Date();
  const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD

  // Run once per day (first check of new day)
  if (dateKey !== lastSemesterSweepDate) {
    lastSemesterSweepDate = dateKey;
    safeRun('semesterSweep', runSemesterSweep);
  }
}, config.semesterSweepIntervalMs);

// ── Analytics Snapshot — check hourly, run on configured weekday + hour ───────

let lastSnapshotWeek = '';

setInterval(() => {
  const now     = new Date();
  const weekday = now.getUTCDay();  // 0 = Sunday
  const hour    = now.getUTCHours();

  // getISOWeekKey equivalent inline
  const d      = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum   = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const weekKey   = `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;

  if (
    weekday === config.snapshotWeekday &&
    hour    === config.snapshotHourUtc &&
    weekKey !== lastSnapshotWeek
  ) {
    lastSnapshotWeek = weekKey;
    safeRun('snapshotJob', runSnapshotJob);
  }
}, config.snapshotCheckIntervalMs);

logger.info(
  {
    batchSweepIntervalMs:    config.batchSweepIntervalMs,
    semesterSweepIntervalMs: config.semesterSweepIntervalMs,
    snapshotCheckIntervalMs: config.snapshotCheckIntervalMs,
    snapshotWeekday:         config.snapshotWeekday,
    snapshotHourUtc:         config.snapshotHourUtc,
  },
  `${config.serviceName} started`,
);
