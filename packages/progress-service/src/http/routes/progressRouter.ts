import { Router }                  from 'express';
import { authenticate, authorize } from '@shared/auth-middleware';
import { container }               from '../../container';

export const progressRouter = Router();

progressRouter.post('/progress/subjects/:id/complete',  authenticate(), authorize('student', 'leader', 'g12'), container.progressController.complete);
progressRouter.post('/progress/subjects/:id/access',    authenticate(), authorize('student', 'leader', 'g12'), container.progressController.access);
progressRouter.get( '/me/progress/courses/:courseId',   authenticate(), authorize('student', 'leader', 'g12'), container.progressController.myCourseProgress);
progressRouter.get( '/me/progress/subjects/:subjectId', authenticate(), authorize('student', 'leader', 'g12'), container.progressController.mySubjectProgress);
progressRouter.get( '/admin/progress/courses/:courseId', authenticate(), authorize('admin'), container.progressController.adminCourseProgress);
