import { Request, Response, NextFunction } from 'express';
import { logger } from '@shared/logger';
import { AppError } from './AppError';

export function errorHandler(
  err:   unknown,
  req:   Request,
  res:   Response,
  _next: NextFunction,
): void {
  const requestId  = (req.headers['x-request-id'] as string | undefined) ?? 'unknown';
  const appError   = err instanceof AppError ? err : null;
  const raw        = (err as Record<string, unknown>).statusCode;
  const statusCode = appError?.status ?? (typeof raw === 'number' ? raw : 500);

  logger.error(
    { err, requestId, method: req.method, url: req.url },
    'Request failed',
  );

  res.status(statusCode).json({
    error: {
      code:    appError?.errorCode ?? 'INTERNAL_ERROR',
      message: statusCode < 500
        ? (err as Error).message
        : 'An internal error occurred. Please try again.',
      details: statusCode === 400 ? appError?.details : undefined,
    },
    requestId,
  });
}
