import { Request, Response, NextFunction } from 'express';
import { fromZodError }                     from '@shared/errors';
import { sendSuccess }                      from '@shared/response';
import { ISemesterRepository }              from '../../domain/repositories/ISemesterRepository';
import { CreateSemesterUseCase }            from '../../application/use-cases/CreateSemesterUseCase';
import { UpdateSemesterUseCase }            from '../../application/use-cases/UpdateSemesterUseCase';
import { DeleteSemesterUseCase }            from '../../application/use-cases/DeleteSemesterUseCase';
import { createSemesterSchema, updateSemesterSchema } from '../validators/semesterValidator';

export class SemesterController {
  constructor(
    private readonly createUseCase:  CreateSemesterUseCase,
    private readonly updateUseCase:  UpdateSemesterUseCase,
    private readonly deleteUseCase:  DeleteSemesterUseCase,
    private readonly semesterRepo:   ISemesterRepository,
  ) {}

  listByCourse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const semesters = await this.semesterRepo.findByCourseId(req.params.id);
      sendSuccess(res, semesters);
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = createSemesterSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const semester = await this.createUseCase.execute({ courseId: req.params.id, ...parsed.data });
      sendSuccess(res, semester, 201);
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = updateSemesterSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const semester = await this.updateUseCase.execute({ id: req.params.id, ...parsed.data });
      sendSuccess(res, semester);
    } catch (err) { next(err); }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.deleteUseCase.execute(req.params.id);
      res.status(204).send();
    } catch (err) { next(err); }
  };
}
