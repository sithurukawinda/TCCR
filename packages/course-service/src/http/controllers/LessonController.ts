import { Request, Response, NextFunction } from 'express';
import { fromZodError }                     from '@shared/errors';
import { sendSuccess }                      from '@shared/response';
import { ILessonRepository }               from '../../domain/repositories/ILessonRepository';
import { CreateLessonUseCase }             from '../../application/use-cases/CreateLessonUseCase';
import { UpdateLessonUseCase }             from '../../application/use-cases/UpdateLessonUseCase';
import { DeleteLessonUseCase }             from '../../application/use-cases/DeleteLessonUseCase';
import { createLessonSchema, updateLessonSchema } from '../validators/lessonValidator';

export class LessonController {
  constructor(
    private readonly lessonRepo: ILessonRepository,
    private readonly createUC:   CreateLessonUseCase,
    private readonly updateUC:   UpdateLessonUseCase,
    private readonly deleteUC:   DeleteLessonUseCase,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const lessons = await this.lessonRepo.findBySubject(req.params.id);
      sendSuccess(res, lessons);
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = createLessonSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const lesson = await this.createUC.execute({ subjectId: req.params.id, ...parsed.data });
      sendSuccess(res, lesson, 201);
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = updateLessonSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const lesson = await this.updateUC.execute({ id: req.params.id, ...parsed.data });
      sendSuccess(res, lesson);
    } catch (err) { next(err); }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.deleteUC.execute(req.params.id);
      res.status(204).send();
    } catch (err) { next(err); }
  };
}
