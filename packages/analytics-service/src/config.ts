export const config = {
  serviceName:        process.env.SERVICE_NAME          ?? 'analytics-service',
  port:               Number(process.env.PORT           ?? 3011),
  nodeEnv:            process.env.NODE_ENV              ?? 'development',
  internalServiceKey: process.env.INTERNAL_SERVICE_KEY  ?? '',
} as const;
