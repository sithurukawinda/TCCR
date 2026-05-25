import { createHttpError }          from '@shared/errors';
import { OutboxEventPublisher }     from '@shared/events';
import { ICellGroupRepository }     from '../../domain/repositories/ICellGroupRepository';
import { ICellReportRepository }    from '../../domain/repositories/ICellReportRepository';
import { CellReport }               from '../../domain/entities/CellReport';
import { Role }                     from '@shared/auth-middleware';

export class VoidReportUseCase {
  constructor(
    private readonly cellRepo:   ICellGroupRepository,
    private readonly reportRepo: ICellReportRepository,
    private readonly outbox:     OutboxEventPublisher,
  ) {}

  async execute(
    cellId:      string,
    reportId:    string,
    reason:      string,
    callerUid:   string,
    callerRoles: Role[],
    requestId:   string,
  ): Promise<CellReport> {
    const cell = await this.cellRepo.findById(cellId);
    if (!cell) throw createHttpError(404, 'CELL_NOT_FOUND', 'Cell group not found.');

    const isAdmin = callerRoles.includes('admin') || callerRoles.includes('super_admin');
    const isOwner = cell.isOwnedBy(callerUid);

    if (!isAdmin && !isOwner) {
      throw createHttpError(403, 'FORBIDDEN', 'Only the cell owner or an admin can void a report.');
    }

    const report = await this.reportRepo.findById(cellId, reportId);
    if (!report) throw createHttpError(404, 'CELL_REPORT_NOT_FOUND', 'Cell report not found.');

    report.void(reason);
    await this.reportRepo.update(report);

    await this.outbox.publishWithBatch({
      type:    'cell_report.voided',
      payload: { cellId, reportId, voidedByUid: callerUid, reason },
      requestId,
    });

    return report;
  }
}
