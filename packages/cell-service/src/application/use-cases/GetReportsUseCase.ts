import { createHttpError }          from '@shared/errors';
import { ICellGroupRepository }     from '../../domain/repositories/ICellGroupRepository';
import { ICellReportRepository,
         CellReportListOptions,
         CellReportListResult }     from '../../domain/repositories/ICellReportRepository';
import { Role }                     from '@shared/auth-middleware';

export class GetReportsUseCase {
  constructor(
    private readonly cellRepo:   ICellGroupRepository,
    private readonly reportRepo: ICellReportRepository,
  ) {}

  async execute(
    cellId:      string,
    opts:        CellReportListOptions,
    callerUid:   string,
    callerRoles: Role[],
  ): Promise<CellReportListResult> {
    const cell = await this.cellRepo.findById(cellId);
    if (!cell) throw createHttpError(404, 'CELL_NOT_FOUND', 'Cell group not found.');

    const isAdmin  = callerRoles.includes('admin') || callerRoles.includes('super_admin');
    const isOwner  = cell.isOwnedBy(callerUid);
    const isMember = cell.hasMember(callerUid);

    if (!isAdmin && !isOwner && !isMember) {
      throw createHttpError(403, 'FORBIDDEN', 'You do not have access to this cell\'s reports.');
    }

    return this.reportRepo.findAll(cellId, opts);
  }
}
