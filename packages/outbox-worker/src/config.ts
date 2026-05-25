export const config = {
  serviceName:           process.env.SERVICE_NAME              ?? 'outbox-worker',
  internalServiceKey:    process.env.INTERNAL_SERVICE_KEY       ?? '',
  pollIntervalSeconds:   Number(process.env.OUTBOX_POLL_INTERVAL_SECONDS ?? 5),
  batchSize:             Number(process.env.OUTBOX_BATCH_SIZE             ?? 20),
  serviceUserUrl:        process.env.SERVICE_USER_URL           ?? 'http://localhost:3002',
  serviceNotifyUrl:      process.env.SERVICE_NOTIFICATION_URL   ?? 'http://localhost:3007',
  serviceAuditUrl:       process.env.SERVICE_AUDIT_URL          ?? 'http://localhost:3008',
} as const;
