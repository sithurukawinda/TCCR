import { Request, Response, NextFunction }       from 'express';
import { fromZodError }                           from '@shared/errors';
import { sendSuccess }                            from '@shared/response';
import { CreateBatchUseCase }                     from '../../application/use-cases/CreateBatchUseCase';
import { GetBatchesUseCase }                      from '../../application/use-cases/GetBatchesUseCase';
import { GetBatchUseCase }                        from '../../application/use-cases/GetBatchUseCase';
import { UpdateBatchUseCase }                     from '../../application/use-cases/UpdateBatchUseCase';
import { OpenBatchUseCase }                       from '../../application/use-cases/OpenBatchUseCase';
import { CloseBatchUseCase }                      from '../../application/use-cases/CloseBatchUseCase';
import { SetBatchSemesterDatesUseCase }           from '../../application/use-cases/SetBatchSemesterDatesUseCase';
import { PatchBatchSemesterDateUseCase }          from '../../application/use-cases/PatchBatchSemesterDateUseCase';
import {
  createBatchSchema,
  updateBatchSchema,
  setBatchSemesterDatesSchema,
  patchBatchSemesterDateSchema,
} from '../validators/batchValidator';

export class BatchController {
  constructor(
    private readonly createUseCase:         CreateBatchUseCase,
    private readonly getBatchesUseCase:     GetBatchesUseCase,
    private readonly getBatchUseCase:       GetBatchUseCase,
    private readonly updateUseCase:         UpdateBatchUseCase,
    private readonly openUseCase:           OpenBatchUseCase,
    private readonly closeUseCase:          CloseBatchUseCase,
    private readonly setDatesUseCase:       SetBatchSemesterDatesUseCase,
    private readonly patchDateUseCase:      PatchBatchSemesterDateUseCase,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const batches = await this.getBatchesUseCase.execute(req.params.id);
      sendSuccess(res, batches);
    } catch (err) { next(err); }
  };

  getOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const batch = await this.getBatchUseCase.execute(req.params.id);
      sendSuccess(res, batch);
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = createBatchSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));

      const batch = await this.createUseCase.execute(req.params.id, parsed.data);
      sendSuccess(res, batch, 201);
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = updateBatchSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));

      const batch = await this.updateUseCase.execute(req.params.id, parsed.data);
      sendSuccess(res, batch);
    } catch (err) { next(err); }
  };

  open = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const batch = await this.openUseCase.execute(req.params.id);
      sendSuccess(res, batch);
    } catch (err) { next(err); }
  };

  close = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const batch = await this.closeUseCase.execute(req.params.id);
      sendSuccess(res, batch);
    } catch (err) { next(err); }
  };

  setSemesterDates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = setBatchSemesterDatesSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const result = await this.setDatesUseCase.execute(
        req.params.courseId,
        req.params.batchId,
        parsed.data.schedule,
      );
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  patchSemesterDate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = patchBatchSemesterDateSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const result = await this.patchDateUseCase.execute(
        req.params.courseId,
        req.params.batchId,
        req.params.semesterId,
        parsed.data,
      );
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };
}
