import { Router }                  from 'express';
import { authenticate, authorize } from '@shared/auth-middleware';
import { tryAuthenticate }         from '../middleware/tryAuthenticate';
import { container }               from '../../container';

export const courseRouter = Router();

// Public / role-aware
courseRouter.get( '/courses',              tryAuthenticate(), container.courseController.list);
courseRouter.get( '/courses/:id',          tryAuthenticate(), container.courseController.getOne);

// Admin
courseRouter.post(  '/courses',                  authenticate(), authorize('admin'), container.courseController.create);
courseRouter.patch( '/courses/:id',              authenticate(), authorize('admin'), container.courseController.update);
courseRouter.post(  '/courses/:id/publish',      authenticate(), authorize('admin'), container.courseController.publish);
courseRouter.post(  '/courses/:id/unpublish',    authenticate(), authorize('admin'), container.courseController.unpublish);
courseRouter.post(  '/courses/:id/archive',      authenticate(), authorize('admin'), container.courseController.archive);
courseRouter.post(  '/courses/:id/restore',      authenticate(), authorize('admin'), container.courseController.restore);
courseRouter.delete('/courses/:id',              authenticate(), authorize('admin'), container.courseController.remove);

// Semesters (under course)
courseRouter.get( '/courses/:id/semesters', authenticate(), authorize('member', 'student', 'leader', 'g12', 'admin', 'super_admin'), container.semesterController.listByCourse);
courseRouter.post('/courses/:id/semesters', authenticate(), authorize('admin'), container.semesterController.create);

// Batch routes — V2
courseRouter.get(  '/courses/:id/batches',   authenticate(), authorize('member', 'student', 'leader', 'g12', 'admin', 'super_admin'), container.batchController.list);
courseRouter.post( '/courses/:id/batches',   authenticate(), authorize('admin'),                                                      container.batchController.create);
courseRouter.get(  '/batches/:id',           authenticate(), authorize('member', 'student', 'leader', 'g12', 'admin', 'super_admin'), container.batchController.getOne);
courseRouter.patch('/batches/:id',           authenticate(), authorize('admin'), container.batchController.update);
courseRouter.post( '/batches/:id/open',      authenticate(), authorize('admin'), container.batchController.open);
courseRouter.post( '/batches/:id/close',     authenticate(), authorize('admin'), container.batchController.close);

// Batch semester dates — V2 (admin only)
courseRouter.put(  '/courses/:courseId/batches/:batchId/semester-dates',                authenticate(), authorize('admin'), container.batchController.setSemesterDates);
courseRouter.patch('/courses/:courseId/batches/:batchId/semester-dates/:semesterId',    authenticate(), authorize('admin'), container.batchController.patchSemesterDate);

// Student course detail — V2 (any authenticated user; scoped to their enrolled batch)
courseRouter.get('/me/courses/:courseId', authenticate(), container.studentCourseController.getOne);
