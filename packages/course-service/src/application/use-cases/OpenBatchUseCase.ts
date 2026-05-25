import { createHttpError }  from '@shared/errors';
import { IBatchRepository } from '../../domain/repositories/IBatchRepository';
import { Batch }            from '../../domain/entities/Batch';

export class OpenBatchUseCase {
  constructor(private readonly batchRepo: IBatchRepository) {}

  async execute(id: string): Promise<Batch> {
    const batch = await this.batchRepo.findById(id);
    if (!batch) throw createHttpError(404, 'BATCH_NOT_FOUND', 'Batch not found.');

    batch.open();
    await this.batchRepo.update(batch);
    return batch;
  }
}
