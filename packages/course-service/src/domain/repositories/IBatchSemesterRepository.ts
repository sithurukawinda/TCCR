import { BatchSemester } from '../entities/BatchSemester';

export interface IBatchSemesterRepository {
  findByBatchId(batchId: string): Promise<BatchSemester[]>;
  findBySemesterId(semesterId: string): Promise<BatchSemester[]>;
  upsertMany(rows: BatchSemester[]): Promise<void>;
  deleteBySemesterId(semesterId: string): Promise<void>;
  deleteByBatchId(batchId: string): Promise<void>;
}
