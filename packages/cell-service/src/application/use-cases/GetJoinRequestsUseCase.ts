import { createHttpError }          from '@shared/errors';
import { ICellGroupRepository }     from '../../domain/repositories/ICellGroupRepository';
import { IJoinRequestRepository,
         JoinRequestListOptions,
         JoinRequestListResult }    from '../../domain/repositories/IJoinRequestRepository';
import { Role }                     from '@shared/auth-middleware';

export class GetJoinRequestsUseCase {
  constructor(
    private readonly cellRepo: ICellGroupRepository,
    private readonly joinRepo: IJoinRequestRepository,
  ) {}

  async execute(
    cellId: string,
    opts: JoinRequestListOptions,
    callerUid: string,
    callerRoles: Role[],
  ): Promise<JoinRequestListResult> {
    const cell = await this.cellRepo.findById(cellId);
    if (!cell) throw createHttpError(404, 'CELL_NOT_FOUND', 'Cell group not found.');

    const isAdmin = callerRoles.includes('admin') || callerRoles.includes('super_admin');
    if (!isAdmin && !cell.isOwnedBy(callerUid)) {
      throw createHttpError(403, 'FORBIDDEN', 'Only the cell owner or an admin can view join requests.');
    }

    return this.joinRepo.findAll(cellId, { ...opts, status: opts.status ?? 'pending' });
  }
}
