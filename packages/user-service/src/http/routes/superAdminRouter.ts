import { Router }                  from 'express';
import { authenticate, authorize } from '@shared/auth-middleware';
import { container }               from '../../container';

export const superAdminRouter = Router();

superAdminRouter.get(   '/super-admin/admins',                    authenticate(), authorize('super_admin'), container.superAdminController.listAdmins);
superAdminRouter.post(  '/super-admin/admins',                    authenticate(), authorize('super_admin'), container.superAdminController.createAdmin);
superAdminRouter.get(   '/super-admin/admins/:uid',               authenticate(), authorize('super_admin'), container.superAdminController.getAdmin);
superAdminRouter.post(  '/super-admin/admins/:uid/suspend',       authenticate(), authorize('super_admin'), container.superAdminController.suspendAdmin);
superAdminRouter.post(  '/super-admin/admins/:uid/reactivate',    authenticate(), authorize('super_admin'), container.superAdminController.reactivateAdmin);
superAdminRouter.delete('/super-admin/admins/:uid',               authenticate(), authorize('super_admin'), container.superAdminController.deleteAdmin);
superAdminRouter.post(  '/super-admin/users/:uid/make-admin',     authenticate(), authorize('super_admin'), container.superAdminController.promoteToAdmin);
