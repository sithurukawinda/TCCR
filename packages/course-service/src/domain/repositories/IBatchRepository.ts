import { Batch } from '../entities/Batch';

export interface IBatchRepository {
  findById(id: string): Promise<Batch | null>;
  findByCourseId(courseId: string): Promise<Batch[]>;
  create(batch: Batch): Promise<void>;
  update(batch: Batch): Promise<void>;
}
