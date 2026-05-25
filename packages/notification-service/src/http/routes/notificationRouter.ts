import { Router }                  from 'express';
import { authenticate, authorize } from '@shared/auth-middleware';
import { container }               from '../../container';

export const notificationRouter = Router();

// V2: notifications accessible to any authenticated role
notificationRouter.get( '/me/notifications',             authenticate(), authorize('member', 'student', 'leader', 'g12', 'admin', 'super_admin'), container.notificationController.list);
notificationRouter.post('/me/notifications/:id/read',    authenticate(), authorize('member', 'student', 'leader', 'g12', 'admin', 'super_admin'), container.notificationController.markRead);
notificationRouter.post('/me/notifications/read-all',    authenticate(), authorize('member', 'student', 'leader', 'g12', 'admin', 'super_admin'), container.notificationController.markAllRead);
