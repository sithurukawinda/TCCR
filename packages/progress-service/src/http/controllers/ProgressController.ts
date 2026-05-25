import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest }             from '@shared/auth-middleware';
import { fromZodError }                     from '@shared/errors';
import { sendSuccess }                      from '@shared/response';
import { MarkSubjectCompleteUseCase }       from '../../application/use-cases/MarkSubjectCompleteUseCase';
import { UpdateLastAccessedUseCase }        from '../../application/use-cases/UpdateLastAccessedUseCase';
import { ComputeCourseProgressUseCase }     from '../../application/use-cases/ComputeCourseProgressUseCase';
import { GetSubjectProgressUseCase }        from '../../application/use-cases/GetSubjectProgressUseCase';
import { IProgressRepository }             from '../../domain/repositories/IProgressRepository';
import { subjectCompleteSchema, subjectAccessSchema } from '../validators/progressValidator';

export class ProgressController {
  constructor(
    private readonly markCompleteUC:    MarkSubjectCompleteUseCase,
    private readonly updateAccessedUC:  UpdateLastAccessedUseCase,
    private readonly computeProgressUC: ComputeCourseProgressUseCase,
    private readonly getSubjectUC:      GetSubjectProgressUseCase,
    private readonly progressRepo:      IProgressRepository,
  ) {}

  complete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = subjectCompleteSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid }   = (req as AuthenticatedRequest).principal;
      const requestId = (req.headers['x-request-id'] as string) ?? '';
      const progress  = await this.markCompleteUC.execute({ studentUid: uid, subjectId: req.params.id, ...parsed.data }, requestId);
      sendSuccess(res, progress);
    } catch (err) { next(err); }
  };

  access = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = subjectAccessSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid }  = (req as AuthenticatedRequest).principal;
      const progress = await this.updateAccessedUC.execute({ studentUid: uid, subjectId: req.params.id, ...parsed.data });
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
}
