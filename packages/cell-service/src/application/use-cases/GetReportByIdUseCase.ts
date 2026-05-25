import { createHttpError }          from '@shared/errors';
import { ICellGroupRepository }     from '../../domain/repositories/ICellGroupRepository';
import { ICellReportRepository }    from '../../domain/repositories/ICellReportRepository';
import { CellReport }               from '../../domain/entities/CellReport';
import { Role }                     from '@shared/auth-middleware';

export class GetReportByIdUseCase {
  constructor(
    private readonly cellRepo:   ICellGroupRepository,
    private readonly reportRepo: ICellReportRepository,
  ) {}

  async execute(cellId: string, reportId: string, callerUid: string, callerRoles: Role[]): Promise<CellReport> {
    const cell = await this.cellRepo.findById(cellId);
    if (!cell) throw createHttpError(404, 'CELL_NOT_FOUND', 'Cell group not found.');

    const isAdmin  = callerRoles.includes('admin') || callerRoles.includes('super_admin');
    const isOwner  = cell.isOwnedBy(callerUid);
    const isMember = cell.hasMember(callerUid);

    if (!isAdmin && !isOwner && !isMember) {
      throw createHttpError(403, 'FORBIDDEN', 'You do not have access to this cell\'s reports.');
    }

    const report = await this.reportRepo.findById(cellId, reportId);
    if (!report) throw createHttpError(404, 'CELL_REPORT_NOT_FOUND', 'Cell report not found.');

    return report;
  }
}
