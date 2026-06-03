import { Request, Response, NextFunction } from 'express';
import { fromZodError }                    from '@shared/errors';
import { sendSuccess, sendPaginated }      from '@shared/response';
import { AuthenticatedRequest }            from '@shared/auth-middleware';
import { CreateAdminUseCase }                from '../../application/use-cases/CreateAdminUseCase';
import { DeleteAdminUseCase }                from '../../application/use-cases/DeleteAdminUseCase';
import { GetUsersUseCase }                   from '../../application/use-cases/GetUsersUseCase';
import { GetUserByIdUseCase }                from '../../application/use-cases/GetUserByIdUseCase';
import { SuspendUserUseCase }                from '../../application/use-cases/SuspendUserUseCase';
import { ReactivateUserUseCase }             from '../../application/use-cases/ReactivateUserUseCase';
import { PromoteToAdminUseCase }             from '../../application/use-cases/PromoteToAdminUseCase';
import { GrantReportsFullAccessUseCase }     from '../../application/use-cases/GrantReportsFullAccessUseCase';
import { RevokeReportsFullAccessUseCase }    from '../../application/use-cases/RevokeReportsFullAccessUseCase';
import { GrantTempMasterAccessUseCase }      from '../../application/use-cases/GrantTempMasterAccessUseCase';
import { ExtendTempMasterAccessUseCase }     from '../../application/use-cases/ExtendTempMasterAccessUseCase';
import { RevokeTempMasterAccessUseCase }     from '../../application/use-cases/RevokeTempMasterAccessUseCase';
import { createAdminSchema, listAdminsSchema, tempMasterAccessSchema } from '../validators/superAdminValidator';

export class SuperAdminController {
  constructor(
    private readonly createAdminUseCase:           CreateAdminUseCase,
    private readonly deleteAdminUseCase:           DeleteAdminUseCase,
    private readonly getUsersUseCase:              GetUsersUseCase,
    private readonly getUserByIdUseCase:           GetUserByIdUseCase,
    private readonly suspendUserUseCase:           SuspendUserUseCase,
    private readonly reactivateUseCase:            ReactivateUserUseCase,
    private readonly promoteToAdminUseCase:        PromoteToAdminUseCase,
    private readonly grantReportsFullAccessUC:     GrantReportsFullAccessUseCase,
    private readonly revokeReportsFullAccessUC:    RevokeReportsFullAccessUseCase,
    private readonly grantTempMasterAccessUC:      GrantTempMasterAccessUseCase,
    private readonly extendTempMasterAccessUC:     ExtendTempMasterAccessUseCase,
    private readonly revokeTempMasterAccessUC:     RevokeTempMasterAccessUseCase,
  ) {}

  listAdmins = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = listAdminsSchema.safeParse(req.query);
      if (!parsed.success) return next(fromZodError(parsed.error));

      const result = await this.getUsersUseCase.execute({ ...parsed.data, role: 'admin' });
      sendPaginated(res, result.items, result.nextCursor, result.total);
    } catch (err) { next(err); }
  };

  createAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = createAdminSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));

      const requestId = (req.headers['x-request-id'] as string) ?? '';
      const user      = await this.createAdminUseCase.execute(parsed.data, requestId);
      sendSuccess(res, user, 201);
    } catch (err) { next(err); }
  };

  getAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { principal } = req as AuthenticatedRequest;
      const user = await this.getUserByIdUseCase.execute(req.params.uid, principal.roles);
      sendSuccess(res, user);
    } catch (err) { next(err); }
  };

  suspendAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requestId = (req.headers['x-request-id'] as string) ?? '';
      const user      = await this.suspendUserUseCase.execute(req.params.uid, requestId);
      sendSuccess(res, user);
    } catch (err) { next(err); }
  };

  reactivateAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.reactivateUseCase.execute(req.params.uid);
      sendSuccess(res, user);
    } catch (err) { next(err); }
  };

  deleteAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.deleteAdminUseCase.execute(req.params.uid);
      res.status(204).send();
    } catch (err) { next(err); }
  };

  promoteToAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid: actorUid } = (req as AuthenticatedRequest).principal;
      const requestId         = (req.headers['x-request-id'] as string) ?? '';
      const user              = await this.promoteToAdminUseCase.execute({
        uid: req.params.uid,
        actorUid,
        requestId,
      });
      sendSuccess(res, user);
    } catch (err) { next(err); }
  };

  grantReportsFullAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid: callerUid } = (req as AuthenticatedRequest).principal;
      const requestId          = (req.headers['x-request-id'] as string) ?? '';
      const user = await this.grantReportsFullAccessUC.execute(req.params.uid, callerUid, requestId);
      sendSuccess(res, { message: 'REPORTS_FULL_ACCESS granted.', uid: user.uid });
    } catch (err) { next(err); }
  };

  revokeReportsFullAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid: callerUid } = (req as AuthenticatedRequest).principal;
      const requestId          = (req.headers['x-request-id'] as string) ?? '';
      const user = await this.revokeReportsFullAccessUC.execute(req.params.uid, callerUid, requestId);
      sendSuccess(res, { message: 'REPORTS_FULL_ACCESS revoked.', uid: user.uid });
    } catch (err) { next(err); }
  };

  grantTempMasterAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = tempMasterAccessSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid: callerUid } = (req as AuthenticatedRequest).principal;
      const requestId          = (req.headers['x-request-id'] as string) ?? '';
      const user = await this.grantTempMasterAccessUC.execute({
        targetUid: req.params.uid,
        callerUid,
        expiresAt: parsed.data.expiresAt,
        requestId,
      });
      sendSuccess(res, { message: 'Temporary Master Access granted.', uid: user.uid, expiresAt: parsed.data.expiresAt });
    } catch (err) { next(err); }
  };

  extendTempMasterAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = tempMasterAccessSchema.safeParse(req.body);
      if (!parsed.success) return next(fromZodError(parsed.error));
      const { uid: callerUid } = (req as AuthenticatedRequest).principal;
      const requestId          = (req.headers['x-request-id'] as string) ?? '';
      const user = await this.extendTempMasterAccessUC.execute({
        targetUid:    req.params.uid,
        callerUid,
        newExpiresAt: parsed.data.expiresAt,
        requestId,
      });
      sendSuccess(res, { message: 'Temporary Master Access extended.', uid: user.uid, expiresAt: parsed.data.expiresAt });
    } catch (err) { next(err); }
  };

  revokeTempMasterAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid: callerUid } = (req as AuthenticatedRequest).principal;
      const requestId          = (req.headers['x-request-id'] as string) ?? '';
      const user = await this.revokeTempMasterAccessUC.execute(req.params.uid, callerUid, requestId);
      sendSuccess(res, { message: 'Temporary Master Access revoked.', uid: user.uid });
    } catch (err) { next(err); }
  };
}
