import { Router }                  from 'express';
import { authenticate, authorize } from '@shared/auth-middleware';
import { container }               from '../../container';

export const masterRouter = Router();

// All routes super_admin only
masterRouter.get(    '/master',                    authenticate(), authorize('super_admin'), container.masterController.getCurrent);
masterRouter.post(   '/master/assign',             authenticate(), authorize('super_admin'), container.masterController.assign);
masterRouter.post(   '/master/invite',             authenticate(), authorize('super_admin'), container.masterController.invite);
masterRouter.post(   '/master/temp-access/:uid',   authenticate(), authorize('super_admin'), container.masterController.grantTempAccess);
masterRouter.delete( '/master/temp-access/:uid',   authenticate(), authorize('super_admin'), container.masterController.revokeTempAccess);
masterRouter.post(   '/master/:uid/suspend',       authenticate(), authorize('super_admin'), container.masterController.suspend);
masterRouter.post(   '/master/:uid/reactivate',    authenticate(), authorize('super_admin'), container.masterController.reactivate);
masterRouter.delete( '/master/:uid',               authenticate(), authorize('super_admin'), container.masterController.deleteMaster);
