import { Request, Response, NextFunction } from 'express';
import { getAuth }                          from 'firebase-admin/auth';
import { AuthenticatedRequest }             from '@shared/auth-middleware';

// Applies auth if a Bearer token is present — never rejects missing tokens.
// Used on public routes where role affects the response shape.
export function tryAuthenticate() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return next();
    try {
      const decoded = await getAuth().verifyIdToken(header.slice(7), true);
      const role    = decoded.role as 'member' | 'student' | 'leader' | 'g12' | 'admin' | 'super_admin' | 'master' | undefined;
      if (role) {
        const roles = (decoded.roles as typeof role[] | undefined) ?? [role];
        const tmaExpiry = decoded.tempMasterAccessExpiresAt as string | undefined;
        (req as AuthenticatedRequest).principal = {
          uid: decoded.uid, email: decoded.email ?? '', role, roles,
          tempReportAccess:  decoded.tempReportAccess  === true,
          reportsFullAccess: decoded.reportsFullAccess === true,
          tempMasterAccess:  !!tmaExpiry && new Date(tmaExpiry) > new Date(),
        };
      }
    } catch { /* ignore bad tokens on public routes */ }
    next();
  };
}
