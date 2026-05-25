export const config = {
  serviceName:          process.env.SERVICE_NAME            ?? 'storage-service',
  port:                 Number(process.env.PORT              ?? 3006),
  nodeEnv:              process.env.NODE_ENV                 ?? 'development',
  internalServiceKey:   process.env.INTERNAL_SERVICE_KEY     ?? '',
  serviceCourseUrl:     process.env.SERVICE_COURSE_URL       ?? 'http://localhost:3003',
  serviceEnrollmentUrl: process.env.SERVICE_ENROLLMENT_URL   ?? 'http://localhost:3004',
  maxFileSizeBytes:     Number(process.env.ATTACHMENT_MAX_SIZE_BYTES ?? 26_214_400),
} as const;
