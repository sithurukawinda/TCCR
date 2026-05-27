import { Router }       from 'express';
import { internalAuth } from '../middleware/internalAuth';
import { container }    from '../../container';

export const internalRouter = Router();

// Course internals
internalRouter.get('/internal/courses/:id/subject-count', internalAuth, container.internalCourseController.subjectCount);
internalRouter.get('/internal/courses/:id/state',         internalAuth, container.internalCourseController.courseState);
internalRouter.get('/internal/courses/:id/lesson-count',  internalAuth, container.internalCourseController.getCourseLessonCount);

// Subject internals — more specific paths before :id catch-all
internalRouter.get('/internal/subjects/:id/lesson-count', internalAuth, container.internalCourseController.getSubjectLessonCount);
internalRouter.get('/internal/subjects/:id',              internalAuth, container.internalCourseController.getSubject);

// Lesson internals
internalRouter.get('/internal/lessons/:id',               internalAuth, container.internalCourseController.getLesson);
