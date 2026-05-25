import { IBatchRepository } from '../../domain/repositories/IBatchRepository';
import { Batch }            from '../../domain/entities/Batch';

export class GetBatchesUseCase {
  constructor(private readonly batchRepo: IBatchRepository) {}

  async execute(courseId: string): Promise<Batch[]> {
    return this.batchRepo.findByCourseId(courseId);
  }
}
