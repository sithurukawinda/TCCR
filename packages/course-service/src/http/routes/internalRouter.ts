import { Router }       from 'express';
import { internalAuth } from '../middleware/internalAuth';
import { container }    from '../../container';

export const internalRouter = Router();

internalRouter.get('/internal/courses/:id/subject-count', internalAuth, container.internalCourseController.subjectCount);
internalRouter.get('/internal/courses/:id/state',         internalAuth, container.internalCourseController.courseState);
internalRouter.get('/internal/subjects/:id',              internalAuth, container.internalCourseController.getSubject);
