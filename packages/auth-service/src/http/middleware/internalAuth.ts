import { Request, Response, NextFunction } from 'express';
import { createHttpError }                 from '@shared/errors';
import { config }                          from '../../config';

export function internalAuth(req: Request, _res: Response, next: NextFunction): void {
  const key = req.headers['x-internal-service-key'];
  if (!key || key !== config.internalServiceKey) {
    return next(createHttpError(401, 'UNAUTHENTICATED', 'Internal service key required.'));
  }
  next();
}
