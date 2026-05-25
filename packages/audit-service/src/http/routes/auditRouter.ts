import { Router }                  from 'express';
import { authenticate, authorize } from '@shared/auth-middleware';
import { container }               from '../../container';

export const auditRouter = Router();

auditRouter.get('/audit-log',            authenticate(), authorize('admin', 'super_admin'), container.auditController.list);
auditRouter.get('/users/:uid/audit-log', authenticate(), authorize('admin', 'super_admin'), container.auditController.userTimeline);
