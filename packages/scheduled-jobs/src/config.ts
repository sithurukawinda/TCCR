export const config = {
  serviceName:            process.env.SERVICE_NAME ?? 'scheduled-jobs',
  nodeEnv:                process.env.NODE_ENV     ?? 'development',

  // Batch sweep: how often to check for batches to open/close (ms)
  batchSweepIntervalMs:   Number(process.env.BATCH_SWEEP_INTERVAL_MS    ?? 15 * 60 * 1000), // 15 min

  // Semester sweep: how often to run the end-date check (ms)
  semesterSweepIntervalMs: Number(process.env.SEMESTER_SWEEP_INTERVAL_MS ?? 60 * 60 * 1000), // 1 hr

  // Snapshot job: how often to check whether to generate weekly snapshots (ms)
  snapshotCheckIntervalMs: Number(process.env.SNAPSHOT_CHECK_INTERVAL_MS ?? 60 * 60 * 1000), // 1 hr

  // ISO weekday (0=Sun) and hour (UTC) to generate snapshots
  snapshotWeekday: Number(process.env.SNAPSHOT_WEEKDAY ?? 0), // Sunday
  snapshotHourUtc: Number(process.env.SNAPSHOT_HOUR_UTC ?? 2), // 02:00 UTC
} as const;
