import { createHttpError }                    from '@shared/errors';
import { IBatchRepository }                   from '../../domain/repositories/IBatchRepository';
import { ISemesterRepository }               from '../../domain/repositories/ISemesterRepository';
import { IBatchSemesterRepository }           from '../../domain/repositories/IBatchSemesterRepository';
import { BatchSemester }                      from '../../domain/entities/BatchSemester';

export interface ScheduleEntry {
  semesterId: string;
  openDate:   string | null;
  endDate:    string | null;
}

export interface BatchSemesterView {
  semesterId: string;
  openDate:   string | null;
  endDate:    string | null;
}

export class SetBatchSemesterDatesUseCase {
  constructor(
    private readonly batchRepo:   IBatchRepository,
    private readonly semesterRepo: ISemesterRepository,
    private readonly bsRepo:      IBatchSemesterRepository,
  ) {}

  async execute(
    courseId: string,
    batchId:  string,
    schedule: ScheduleEntry[],
  ): Promise<BatchSemesterView[]> {
    // 1. Verify batch exists and belongs to this course
    const batch = await this.batchRepo.findById(batchId);
    if (!batch || batch.courseId !== courseId) {
      throw createHttpError(404, 'BATCH_NOT_FOUND', 'Batch not found.');
    }

    // 2. Load all non-deleted semesters for the course
    const semesters  = await this.semesterRepo.findByCourseId(courseId);
    const semesterIds = new Set(semesters.map(s => s.id));

    // 3. Unknown semester check
    for (const entry of schedule) {
      if (!semesterIds.has(entry.semesterId)) {
        throw createHttpError(400, 'UNKNOWN_SEMESTER', `Semester ${entry.semesterId} does not belong to this course.`, { semesterId: [entry.semesterId] });
      }
    }

    // 4. Missing semester check
    const scheduleIds = new Set(schedule.map(e => e.semesterId));
    const missing = semesters.filter(s => !scheduleIds.has(s.id)).map(s => s.id);
    if (missing.length > 0) {
      throw createHttpError(400, 'MISSING_SEMESTERS', 'schedule must contain one entry per semester.', { missingSemesterIds: missing });
    }

    // 5–7. Per-row validation
    const scheduled: Array<{ semesterId: string; open: string; end: string }> = [];

    for (const entry of schedule) {
      const halfSet = (entry.openDate === null) !== (entry.endDate === null);
      if (halfSet) {
        throw createHttpError(400, 'BATCH_SEMESTER_DATES_HALF', `Semester ${entry.semesterId}: both openDate and endDate must be set together or both null.`, { semesterId: [entry.semesterId] });
      }
      if (entry.openDate !== null && entry.endDate !== null) {
        if (entry.openDate > entry.endDate) {
          throw createHttpError(400, 'BATCH_SEMESTER_DATES_ORDER', `Semester ${entry.semesterId}: openDate must be on or before endDate.`, { semesterId: [entry.semesterId] });
        }
        if (entry.openDate < batch.intakeStart || entry.endDate > batch.intakeEnd) {
          throw createHttpError(400, 'BATCH_SEMESTER_DATES_OUTSIDE_BATCH', `Semester ${entry.semesterId}: dates must lie within the batch window (${batch.intakeStart} – ${batch.intakeEnd}).`, { semesterId: [entry.semesterId] });
        }
        scheduled.push({ semesterId: entry.semesterId, open: entry.openDate, end: entry.endDate });
      }
    }

    // Overlap check among fully-scheduled rows
    for (let i = 0; i < scheduled.length; i++) {
      for (let j = i + 1; j < scheduled.length; j++) {
        const a = scheduled[i];
        const b = scheduled[j];
        if (a.open <= b.end && b.open <= a.end) {
          throw createHttpError(400, 'BATCH_SEMESTER_DATES_OVERLAP', `Semesters ${a.semesterId} and ${b.semesterId} have overlapping date windows.`, { semesterIds: [a.semesterId, b.semesterId] });
        }
      }
    }

    // 8. Upsert atomically
    const now  = new Date().toISOString();
    const rows = schedule.map(entry => new BatchSemester({
      id:         `${batchId}_${entry.semesterId}`,
      batchId,
      semesterId: entry.semesterId,
      courseId,
      openDate:   entry.openDate,
      endDate:    entry.endDate,
      createdAt:  now,
      updatedAt:  now,
    }));

    await this.bsRepo.upsertMany(rows);

    return rows.map(r => ({ semesterId: r.semesterId, openDate: r.openDate, endDate: r.endDate }));
  }
}
