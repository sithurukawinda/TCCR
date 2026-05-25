import { Router }                  from 'express';
import { authenticate, authorize } from '@shared/auth-middleware';
import { container }               from '../../container';

export const analyticsRouter = Router();

// Accessible to leader, g12, admin, super_admin
analyticsRouter.get('/analytics/cells/weekly',    authenticate(), authorize('leader', 'g12', 'admin', 'super_admin'), container.analyticsController.weeklyCells);
analyticsRouter.get('/analytics/attendance',      authenticate(), authorize('leader', 'g12', 'admin', 'super_admin'), container.analyticsController.attendance);
analyticsRouter.get('/analytics/meeting-types',   authenticate(), authorize('leader', 'g12', 'admin', 'super_admin'), container.analyticsController.meetingTypes);

// G12 and above only
analyticsRouter.get('/analytics/growth',          authenticate(), authorize('g12', 'admin', 'super_admin'), container.analyticsController.growth);
analyticsRouter.get('/analytics/participation',   authenticate(), authorize('g12', 'admin', 'super_admin'), container.analyticsController.participation);

// CSV export — g12 and above
analyticsRouter.get('/analytics/:chart/export',   authenticate(), authorize('g12', 'admin', 'super_admin'), container.analyticsController.export);
