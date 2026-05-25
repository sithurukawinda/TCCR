export const config = {
  serviceName:        process.env.SERVICE_NAME     ?? 'audit-service',
  port:               Number(process.env.PORT      ?? 3008),
  nodeEnv:            process.env.NODE_ENV         ?? 'development',
  internalServiceKey: process.env.INTERNAL_SERVICE_KEY ?? '',
} as const;
