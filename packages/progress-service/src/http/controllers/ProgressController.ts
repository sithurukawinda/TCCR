import { Request, Response, NextFunction }        from 'express';
import { AuthenticatedRequest }                   from '@shared/auth-middleware';
import { fromZodError }                           from '@shared/errors';
import { sendSuccess }                            from '@shared/response';
import { MarkSubjectCompleteUseCase }             from '../../application/use-cases/MarkSubjectCompleteUseCase';
import { UpdateLastAccessedUseCase }              from '../../application/use-cases/UpdateLastAccessedUseCase';
import { ComputeCourseProgressUseCase }           from '../../application/use-cases/ComputeCourseProgressUseCase';
import { GetSubjectProgressUseCase }              from '../../application/use-cases/GetSubjectProgressUseCase';
import { MarkLessonCompleteUseCase }              from '../../application/use-cases/MarkLessonCompleteUseCase';
import { UnmarkLessonCompleteUseCase }            from '../../application/use-cases/UnmarkLessonCompleteUseCase';
import { SaveVideoPositionUseCase }               from '../../application/use-cases/SaveVideoPositionUseCase';
import { GetVideoPositionUseCase }                from '../../application/use-cases/GetVideoPositionUseCase';
import { IProgressRepository }                   from '../../domain/repositories/IProgressRepository';
import {
  subjectCompleteSchema,
  subjectAccessSchema,
  lessonCompleteSchema,
  saveVideoPositionSchema,
} from '../validators/progressValidator';

export class ProgressController {
  constructor(
    private readonly markCompleteUC:       MarkSubjectCompleteUseCase,
    private readonly updateAccessedUC:     UpdateLastAccessedUseCase,
    private readonly computeProgressUC:    ComputeCourseProgressUseCase,
    private readonly getSubjectUC:         GetSubjectProgressUseCase,
    private readonly markLessonCompleteUC: MarkLessonCompleteUseCase,
    private readonly unmarkLessonUC:       UnmarkLessonCompleteUseCase,
    private readonly progressRepo:         IProgressRepository,
    private readonly saveVideoPositionUC:  SaveVideoPositionUseCase,
    private readonly getVideoPositionUC:   GetVideoPositionUseCase,
  ) {}

  complete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = subjectCompleteSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid }   = (req as AuthenticatedRequest).principal;
      const requestId = (req.headers['x-request-id'] as string) ?? '';
      const progress  = await this.markCompleteUC.execute(
        { studentUid: uid, subjectId: req.params.id, ...parsed.data },
        requestId,
      );
      sendSuccess(res, progress);
    } catch (err) { next(err); }
  };

  access = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = subjectAccessSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid }  = (req as AuthenticatedRequest).principal;
      const progress = await this.updateAccessedUC.execute(
        { studentUid: uid, subjectId: req.params.id, ...parsed.data },
      );
      sendSuccess(res, progress);
    } catch (err) { next(err); }
  };

  myCourseProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid } = (req as AuthenticatedRequest).principal;
      const result  = await this.computeProgressUC.execute(uid, req.params.courseId);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  mySubjectProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid } = (req as AuthenticatedRequest).principal;
      const result  = await this.getSubjectUC.execute(uid, req.params.subjectId);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  adminCourseProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const records = await this.progressRepo.findByCourse(req.params.courseId);
      sendSuccess(res, records);
    } catch (err) { next(err); }
  };

  completeLesson = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = lessonCompleteSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid }   = (req as AuthenticatedRequest).principal;
      const requestId = (req.headers['x-request-id'] as string) ?? '';
      const result    = await this.markLessonCompleteUC.execute(
        {
          studentUid: uid,
          lessonId:   req.params.lessonId,
          batchId:    parsed.data.batchId ?? null,
          ...parsed.data,
        },
        requestId,
      );
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  uncompleteLesson = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid } = (req as AuthenticatedRequest).principal;
      await this.unmarkLessonUC.execute({ studentUid: uid, lessonId: req.params.lessonId });
      res.status(204).end();
    } catch (err) { next(err); }
  };

  saveVideoPosition = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = saveVideoPositionSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid } = (req as AuthenticatedRequest).principal;
      const result  = await this.saveVideoPositionUC.execute(
        uid,
        req.params.lessonId,
        parsed.data.courseId,
        parsed.data.watchedSeconds,
      );
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  getVideoPosition = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid } = (req as AuthenticatedRequest).principal;
      const result  = await this.getVideoPositionUC.execute(uid, req.params.lessonId);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };
}
