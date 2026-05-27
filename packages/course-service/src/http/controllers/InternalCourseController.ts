import { Request, Response, NextFunction } from 'express';
import { createHttpError }                  from '@shared/errors';
import { sendSuccess }                      from '@shared/response';
import { GetSubjectCountUseCase }           from '../../application/use-cases/GetSubjectCountUseCase';
import { ICourseRepository }               from '../../domain/repositories/ICourseRepository';
import { ISubjectRepository }              from '../../domain/repositories/ISubjectRepository';
import { ILessonRepository }               from '../../domain/repositories/ILessonRepository';

export class InternalCourseController {
  constructor(
    private readonly getSubjectCountUseCase: GetSubjectCountUseCase,
    private readonly courseRepo:             ICourseRepository,
    private readonly subjectRepo:            ISubjectRepository,
    private readonly lessonRepo:             ILessonRepository,
  ) {}

  subjectCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.getSubjectCountUseCase.execute(req.params.id);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  courseState = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const course = await this.courseRepo.findById(req.params.id);
      if (!course) return next(createHttpError(404, 'COURSE_NOT_FOUND', 'Course not found.'));
      sendSuccess(res, { id: course.id, state: course.state, title: course.title });
    } catch (err) { next(err); }
  };

  getSubject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const subject = await this.subjectRepo.findById(req.params.id);
      if (!subject) return next(createHttpError(404, 'SUBJECT_NOT_FOUND', 'Subject not found.'));
      sendSuccess(res, { id: subject.id, courseId: subject.courseId, semesterId: subject.semesterId });
    } catch (err) { next(err); }
  };

  getLesson = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const lesson = await this.lessonRepo.findById(req.params.id);
      if (!lesson) return next(createHttpError(404, 'LESSON_NOT_FOUND', 'Lesson not found.'));
      sendSuccess(res, {
        id:        lesson.id,
        subjectId: lesson.subjectId,
        courseId:  lesson.courseId,
        semesterId: lesson.semesterId,
      });
    } catch (err) { next(err); }
  };

  getSubjectLessonCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const lessonCount = await this.lessonRepo.countBySubject(req.params.id);
      sendSuccess(res, { lessonCount });
    } catch (err) { next(err); }
  };

  getCourseLessonCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const lessonCount = await this.lessonRepo.countByCourse(req.params.id);
      sendSuccess(res, { lessonCount });
    } catch (err) { next(err); }
  };
}
