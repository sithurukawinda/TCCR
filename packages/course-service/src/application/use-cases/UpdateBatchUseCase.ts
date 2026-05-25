import { createHttpError }  from '@shared/errors';
import { IBatchRepository } from '../../domain/repositories/IBatchRepository';
import { Batch }            from '../../domain/entities/Batch';

export interface UpdateBatchFields {
  name?:            string;
  scheduledOpenAt?: string | null;
  intakeStart?:     string;
  intakeEnd?:       string;
  capacity?:        number | null;
}

export class UpdateBatchUseCase {
  constructor(private readonly batchRepo: IBatchRepository) {}

  async execute(id: string, fields: UpdateBatchFields): Promise<Batch> {
    const batch = await this.batchRepo.findById(id);
    if (!batch) throw createHttpError(404, 'BATCH_NOT_FOUND', 'Batch not found.');

    const hasDateChange =
      fields.scheduledOpenAt !== undefined ||
      fields.intakeStart     !== undefined ||
      fields.intakeEnd       !== undefined;

    if (batch.state !== 'draft' && hasDateChange) {
      throw createHttpError(409, 'INVALID_STATE', 'Cannot change dates after batch is open.');
    }

    batch.update(fields);
    await this.batchRepo.update(batch);
    return batch;
  }
}
