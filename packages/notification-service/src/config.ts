export const config = {
  serviceName:        process.env.SERVICE_NAME     ?? 'notification-service',
  port:               Number(process.env.PORT      ?? 3007),
  nodeEnv:            process.env.NODE_ENV         ?? 'development',
  internalServiceKey: process.env.INTERNAL_SERVICE_KEY ?? '',
  serviceUserUrl:     process.env.SERVICE_USER_URL ?? 'http://localhost:3002',
  sendgridApiKey:     process.env.SENDGRID_API_KEY ?? '',
  emailFrom:          process.env.EMAIL_FROM       ?? 'noreply@cmp.com',
  smtpHost:           process.env.SMTP_HOST        ?? 'smtp.gmail.com',
  smtpPort:           Number(process.env.SMTP_PORT ?? 587),
  smtpUser:           process.env.SMTP_USER        ?? '',
  smtpPass:           process.env.SMTP_PASS        ?? '',
} as const;
