import { createHttpError }              from '@shared/errors';
import { IBatchRepository }             from '../../domain/repositories/IBatchRepository';
import { IBatchSemesterRepository }     from '../../domain/repositories/IBatchSemesterRepository';
import { Batch }                        from '../../domain/entities/Batch';

export class OpenBatchUseCase {
  constructor(
    private readonly batchRepo: IBatchRepository,
    private readonly bsRepo:    IBatchSemesterRepository,
  ) {}

  async execute(id: string): Promise<Batch> {
    const batch = await this.batchRepo.findById(id);
    if (!batch) throw createHttpError(404, 'BATCH_NOT_FOUND', 'Batch not found.');

    // All semester windows must be fully scheduled before a batch can open
    const bsRows = await this.bsRepo.findByBatchId(id);
    const incomplete = bsRows.filter(r => !r.isScheduled()).map(r => r.semesterId);
    if (incomplete.length > 0) {
      throw createHttpError(
        400,
        'BATCH_SEMESTER_DATES_INCOMPLETE',
        'All semester dates must be set before opening a batch.',
        { missingSemesterIds: incomplete },
      );
    }

    batch.open();
    await this.batchRepo.update(batch);
    return batch;
  }
}
