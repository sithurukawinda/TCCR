import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendPaginated }      from '@shared/response';
import { AuthenticatedRequest }            from '@shared/auth-middleware';
import { GrantMasterUseCase }              from '../../application/use-cases/GrantMasterUseCase';
import { RevokeMasterUseCase }             from '../../application/use-cases/RevokeMasterUseCase';
import { ListMasterUsersUseCase }          from '../../application/use-cases/ListMasterUsersUseCase';
import { TransferMasterUseCase }           from '../../application/use-cases/TransferMasterUseCase';

export class MasterController {
  constructor(
    private readonly grantMasterUC:     GrantMasterUseCase,
    private readonly revokeMasterUC:    RevokeMasterUseCase,
    private readonly listMasterUsersUC: ListMasterUsersUseCase,
    private readonly transferMasterUC:  TransferMasterUseCase,
  ) {}

  listMasters = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit  = Math.min(Number(req.query.limit) || 20, 100);
      const cursor = req.query.cursor as string | undefined;
      const result = await this.listMasterUsersUC.execute(limit, cursor);
      sendPaginated(res, result.items, result.nextCursor, result.total);
    } catch (err) { next(err); }
  };

  grantMaster = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid: callerUid } = (req as AuthenticatedRequest).principal;
      await this.grantMasterUC.execute(req.params.uid, callerUid);
      sendSuccess(res, { message: 'Master role granted successfully.' });
    } catch (err) { next(err); }
  };

  revokeMaster = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid: callerUid } = (req as AuthenticatedRequest).principal;
      await this.revokeMasterUC.execute(req.params.uid, callerUid);
      sendSuccess(res, { message: 'Master role revoked successfully.' });
    } catch (err) { next(err); }
  };

  transferMaster = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid: callerUid } = (req as AuthenticatedRequest).principal;
      const requestId = (req.headers['x-request-id'] as string) ?? '';
      await this.transferMasterUC.execute(req.params.uid, callerUid, requestId);
      sendSuccess(res, { message: 'Master position transferred successfully.' });
    } catch (err) { next(err); }
  };
}
