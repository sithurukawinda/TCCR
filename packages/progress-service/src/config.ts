export const config = {
  serviceName:        process.env.SERVICE_NAME     ?? 'progress-service',
  port:               Number(process.env.PORT      ?? 3005),
  nodeEnv:            process.env.NODE_ENV         ?? 'development',
  internalServiceKey: process.env.INTERNAL_SERVICE_KEY ?? '',
  serviceCourseUrl:   process.env.SERVICE_COURSE_URL   ?? 'http://localhost:3003',
} as const;
