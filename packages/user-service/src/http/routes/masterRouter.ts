import { Router }                  from 'express';
import { authenticate, authorize } from '@shared/auth-middleware';
import { container }               from '../../container';

export const masterRouter = Router();

// Only master and super_admin can access these routes
masterRouter.get(   '/master/users',      authenticate(), authorize('master', 'super_admin'), container.masterController.listMasters);
masterRouter.post(  '/master/grant/:uid', authenticate(), authorize('master', 'super_admin'), container.masterController.grantMaster);
masterRouter.delete('/master/revoke/:uid',  authenticate(), authorize('master', 'super_admin'), container.masterController.revokeMaster);
// promote = position transfer: master only (super_admin cannot transfer what they don't hold)
masterRouter.post( '/master/promote/:uid', authenticate(), authorize('master'),               container.masterController.transferMaster);
