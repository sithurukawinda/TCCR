import { Request, Response, NextFunction }  from 'express';
import { fromZodError }                      from '@shared/errors';
import { sendSuccess, sendPaginated }        from '@shared/response';
import { ApproveRegistrationUseCase }        from '../../application/use-cases/ApproveRegistrationUseCase';
import { RejectRegistrationUseCase }         from '../../application/use-cases/RejectRegistrationUseCase';
import { BulkApproveRegistrationsUseCase }   from '../../application/use-cases/BulkApproveRegistrationsUseCase';
import { IRegistrationRepository }          from '../../domain/repositories/IRegistrationRepository';
import { rejectSchema, bulkApproveSchema, listSchema } from '../validators/enrollmentValidator';

export class RegistrationController {
  constructor(
    private readonly regRepo:      IRegistrationRepository,
    private readonly approveUC:    ApproveRegistrationUseCase,
    private readonly rejectUC:     RejectRegistrationUseCase,
    private readonly bulkApproveUC: BulkApproveRegistrationsUseCase,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = listSchema.safeParse(req.query);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const result = await this.regRepo.findAll({ limit: parsed.data.limit, cursor: parsed.data.cursor, state: parsed.data.status as 'pending' | 'approved' | 'rejected' | undefined });
      sendPaginated(res, result.items, result.nextCursor, result.total);
    } catch (err) { next(err); }
  };

  approve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requestId = (req.headers['x-request-id'] as string) ?? '';
      const reg       = await this.approveUC.execute(req.params.id, requestId);
      sendSuccess(res, reg);
    } catch (err) { next(err); }
  };

  reject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = rejectSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const requestId = (req.headers['x-request-id'] as string) ?? '';
      const reg       = await this.rejectUC.execute(req.params.id, parsed.data.reason, requestId);
      sendSuccess(res, reg);
    } catch (err) { next(err); }
  };

  bulkApprove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = bulkApproveSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const requestId = (req.headers['x-request-id'] as string) ?? '';
      const result    = await this.bulkApproveUC.execute(parsed.data.ids, requestId);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };
}

