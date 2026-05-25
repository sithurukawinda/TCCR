import { Request, Response, NextFunction } from 'express';
import { createHttpError }                  from '@shared/errors';
import { sendSuccess }                      from '@shared/response';
import { GetSubjectCountUseCase }           from '../../application/use-cases/GetSubjectCountUseCase';
import { ICourseRepository }               from '../../domain/repositories/ICourseRepository';
import { ISubjectRepository }              from '../../domain/repositories/ISubjectRepository';

export class InternalCourseController {
  constructor(
    private readonly getSubjectCountUseCase: GetSubjectCountUseCase,
    private readonly courseRepo:             ICourseRepository,
    private readonly subjectRepo:            ISubjectRepository,
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
}
