import { Router }                  from 'express';
import { authenticate, authorize } from '@shared/auth-middleware';
import { container }               from '../../container';

export const lessonRouter = Router();

lessonRouter.get(   '/subjects/:id/lessons', authenticate(), authorize('student', 'leader', 'g12', 'admin', 'super_admin'), container.lessonController.list);
lessonRouter.post(  '/subjects/:id/lessons', authenticate(), authorize('admin'),                           container.lessonController.create);
lessonRouter.patch( '/lessons/:id',          authenticate(), authorize('admin'),                           container.lessonController.update);
lessonRouter.delete('/lessons/:id',          authenticate(), authorize('admin'),                           container.lessonController.remove);
