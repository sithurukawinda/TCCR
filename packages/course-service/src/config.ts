export const config = {
  serviceName:        process.env.SERVICE_NAME     ?? 'course-service',
  port:               Number(process.env.PORT      ?? 3003),
  nodeEnv:            process.env.NODE_ENV         ?? 'development',
  internalServiceKey: process.env.INTERNAL_SERVICE_KEY ?? '',
} as const;
