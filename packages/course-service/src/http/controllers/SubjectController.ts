import { Request, Response, NextFunction } from 'express';
import { fromZodError }                     from '@shared/errors';
import { sendSuccess }                      from '@shared/response';
import { ISubjectRepository }              from '../../domain/repositories/ISubjectRepository';
import { CreateSubjectUseCase }             from '../../application/use-cases/CreateSubjectUseCase';
import { UpdateSubjectUseCase }             from '../../application/use-cases/UpdateSubjectUseCase';
import { DeleteSubjectUseCase }             from '../../application/use-cases/DeleteSubjectUseCase';
import { createSubjectSchema, updateSubjectSchema } from '../validators/subjectValidator';

export class SubjectController {
  constructor(
    private readonly createUseCase:  CreateSubjectUseCase,
    private readonly updateUseCase:  UpdateSubjectUseCase,
    private readonly deleteUseCase:  DeleteSubjectUseCase,
    private readonly subjectRepo:    ISubjectRepository,
  ) {}

  listBySemester = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const subjects = await this.subjectRepo.findBySemesterId(req.params.id);
      sendSuccess(res, subjects);
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = createSubjectSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));

      const subject = await this.createUseCase.execute({ semesterId: req.params.id, ...parsed.data });
      sendSuccess(res, subject, 201);
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = updateSubjectSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));

      const subject = await this.updateUseCase.execute({ id: req.params.id, ...parsed.data });
      sendSuccess(res, subject);
    } catch (err) { next(err); }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.deleteUseCase.execute(req.params.id);
      res.status(204).send();
    } catch (err) { next(err); }
  };
}
