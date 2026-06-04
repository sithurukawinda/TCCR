import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest }            from '@shared/auth-middleware';
import { fromZodError }                    from '@shared/errors';
import { sendSuccess }                     from '@shared/response';
import { z }                               from 'zod';
import { AssignMasterUseCase }             from '../../application/use-cases/AssignMasterUseCase';
import { InviteMasterUseCase }             from '../../application/use-cases/InviteMasterUseCase';
import { SuspendMasterUseCase }            from '../../application/use-cases/SuspendMasterUseCase';
import { ReactivateMasterUseCase }         from '../../application/use-cases/ReactivateMasterUseCase';
import { DeleteMasterUseCase }             from '../../application/use-cases/DeleteMasterUseCase';
import { GetMasterUseCase }                from '../../application/use-cases/GetMasterUseCase';
import { GrantTempReportAccessUseCase }    from '../../application/use-cases/GrantTempReportAccessUseCase';
import { RevokeTempReportAccessUseCase }   from '../../application/use-cases/RevokeTempReportAccessUseCase';

const assignSchema = z.object({
  uid: z.string().min(1),
});

const inviteSchema = z.object({
  firstName:       z.string().min(1).max(50),
  lastName:        z.string().min(1).max(50),
  email:           z.string().email(),
  initialPassword: z.string().min(8),
});

export class MasterController {
  constructor(
    private readonly assignUC:          AssignMasterUseCase,
    private readonly inviteUC:          InviteMasterUseCase,
    private readonly suspendUC:         SuspendMasterUseCase,
    private readonly reactivateUC:      ReactivateMasterUseCase,
    private readonly deleteUC:          DeleteMasterUseCase,
    private readonly getUC:             GetMasterUseCase,
    private readonly grantTempUC:       GrantTempReportAccessUseCase,
    private readonly revokeTempUC:      RevokeTempReportAccessUseCase,
  ) {}

  getCurrent = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const master = await this.getUC.execute();
      sendSuccess(res, master ?? { message: 'No active master.' });
    } catch (err) { next(err); }
  };

  assign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = assignSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const callerUid  = (req as AuthenticatedRequest).principal.uid;
      const requestId  = (req.headers['x-request-id'] as string) ?? '';
      const user = await this.assignUC.execute(parsed.data.uid, callerUid, requestId);
      sendSuccess(res, user);
    } catch (err) { next(err); }
  };

  invite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = inviteSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const requestId = (req.headers['x-request-id'] as string) ?? '';
      const user = await this.inviteUC.execute(parsed.data, requestId);
      sendSuccess(res, user, 201);
    } catch (err) { next(err); }
  };

  suspend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.suspendUC.execute(req.params.uid);
      sendSuccess(res, user);
    } catch (err) { next(err); }
  };

  reactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.reactivateUC.execute(req.params.uid);
      sendSuccess(res, user);
    } catch (err) { next(err); }
  };

  deleteMaster = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid: callerUid, email: callerEmail } = (req as AuthenticatedRequest).principal;
      const requestId = (req.headers['x-request-id'] as string) ?? '';
      await this.deleteUC.execute(req.params.uid, callerUid, callerEmail, requestId);
      res.status(204).end();
    } catch (err) { next(err); }
  };

  grantTempAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.grantTempUC.execute(req.params.uid);
      sendSuccess(res, { message: 'Temporary report access granted.', uid: user.uid });
    } catch (err) { next(err); }
  };

  revokeTempAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.revokeTempUC.execute(req.params.uid);
      sendSuccess(res, { message: 'Temporary report access revoked.', uid: user.uid });
    } catch (err) { next(err); }
  };
}
