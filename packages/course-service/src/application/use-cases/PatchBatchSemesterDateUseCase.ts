import { createHttpError }          from '@shared/errors';
import { IBatchRepository }          from '../../domain/repositories/IBatchRepository';
import { ISemesterRepository }       from '../../domain/repositories/ISemesterRepository';
import { IBatchSemesterRepository }  from '../../domain/repositories/IBatchSemesterRepository';
import { BatchSemester }             from '../../domain/entities/BatchSemester';

export interface PatchBatchSemesterInput {
  openDate: string | null;
  endDate:  string | null;
}

export interface BatchSemesterView {
  semesterId: string;
  openDate:   string | null;
  endDate:    string | null;
}

export class PatchBatchSemesterDateUseCase {
  constructor(
    private readonly batchRepo:    IBatchRepository,
    private readonly semesterRepo: ISemesterRepository,
    private readonly bsRepo:       IBatchSemesterRepository,
  ) {}

  async execute(
    courseId:   string,
    batchId:    string,
    semesterId: string,
    input:      PatchBatchSemesterInput,
  ): Promise<BatchSemesterView> {
    // Verify batch
    const batch = await this.batchRepo.findById(batchId);
    if (!batch || batch.courseId !== courseId) {
      throw createHttpError(404, 'BATCH_NOT_FOUND', 'Batch not found.');
    }

    // Verify semester belongs to course
    const semester = await this.semesterRepo.findById(semesterId);
    if (!semester || semester.courseId !== courseId) {
      throw createHttpError(404, 'SEMESTER_NOT_FOUND', 'Semester not found.');
    }

    const { openDate, endDate } = input;

    const halfSet = (openDate === null) !== (endDate === null);
    if (halfSet) {
      throw createHttpError(400, 'BATCH_SEMESTER_DATES_HALF', 'Both openDate and endDate must be set together or both null.');
    }

    if (openDate !== null && endDate !== null) {
      if (openDate > endDate) {
        throw createHttpError(400, 'BATCH_SEMESTER_DATES_ORDER', 'openDate must be on or before endDate.');
      }
      if (openDate < batch.intakeStart || endDate > batch.intakeEnd) {
        throw createHttpError(400, 'BATCH_SEMESTER_DATES_OUTSIDE_BATCH', `Dates must lie within the batch window (${batch.intakeStart} – ${batch.intakeEnd}).`);
      }
    }

    const now = new Date().toISOString();
    const row = new BatchSemester({
      id:         `${batchId}_${semesterId}`,
      batchId,
      semesterId,
      courseId,
      openDate,
      endDate,
      createdAt:  now,
      updatedAt:  now,
    });

    await this.bsRepo.upsertMany([row]);

    return { semesterId, openDate, endDate };
  }
}
