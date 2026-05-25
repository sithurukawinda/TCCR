import pino from 'pino';
import pinoHttp from 'pino-http';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    service: process.env.SERVICE_NAME,
    version: process.env.SERVICE_VERSION,
    env:     process.env.NODE_ENV,
  },
  serializers: {
    req: (req: { method: string; url: string; headers: Record<string, string> }) => ({
      method:    req.method,
      url:       req.url,
      requestId: req.headers['x-request-id'],
    }),
    err: pino.stdSerializers.err,
  },
  redact: {
    paths: [
      'req.headers.authorization',
      '*.password',
      '*.token',
      '*.idToken',
      '*.privateKey',
    ],
    censor: '[REDACTED]',
  },
});

export const httpLogger = pinoHttp({
  logger,
  customLogLevel: (_req, res) => {
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) =>
    `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res) =>
    `${req.method} ${req.url} ${res.statusCode}`,
});
