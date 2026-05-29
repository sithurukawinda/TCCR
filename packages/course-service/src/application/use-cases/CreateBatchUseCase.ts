import { v4 as uuidv4 }                    from 'uuid';
import { createHttpError }                  from '@shared/errors';
import { ICourseRepository }               from '../../domain/repositories/ICourseRepository';
import { IBatchRepository }                from '../../domain/repositories/IBatchRepository';
import { ISemesterRepository }             from '../../domain/repositories/ISemesterRepository';
import { IBatchSemesterRepository }        from '../../domain/repositories/IBatchSemesterRepository';
import { Batch }                           from '../../domain/entities/Batch';
import { BatchSemester }                   from '../../domain/entities/BatchSemester';

export interface CreateBatchInput {
  name:            string;
  scheduledOpenAt: string | null;
  intakeStart:     string;
  intakeEnd:       string;
  capacity:        number | null;
}

export class CreateBatchUseCase {
  constructor(
    private readonly courseRepo:   ICourseRepository,
    private readonly batchRepo:    IBatchRepository,
    private readonly semesterRepo: ISemesterRepository,
    private readonly bsRepo:       IBatchSemesterRepository,
  ) {}

  async execute(courseId: string, input: CreateBatchInput): Promise<Batch> {
    const course = await this.courseRepo.findById(courseId);
    if (!course) throw createHttpError(404, 'COURSE_NOT_FOUND', 'Course not found.');

    const now   = new Date().toISOString();
    const batch = new Batch({
      id:              uuidv4(),
      courseId,
      name:            input.name,
      scheduledOpenAt: input.scheduledOpenAt ?? null,
      intakeStart:     input.intakeStart,
      intakeEnd:       input.intakeEnd,
      capacity:        input.capacity ?? null,
      state:           'draft',
      createdAt:       now,
      updatedAt:       now,
    });

    if (input.scheduledOpenAt && input.scheduledOpenAt <= now) {
      batch.open();
    }

    await this.batchRepo.create(batch);

    // Auto-create a BatchSemester row (null dates) for every existing semester of this course
    const semesters = await this.semesterRepo.findByCourseId(courseId);
    const active    = semesters.filter(s => s.deletedAt === null);
    if (active.length > 0) {
      const bsRows = active.map(s => new BatchSemester({
        id:         `${batch.id}_${s.id}`,
        batchId:    batch.id,
        semesterId: s.id,
        courseId,
        openDate:   null,
        endDate:    null,
        createdAt:  now,
        updatedAt:  now,
      }));
      await this.bsRepo.upsertMany(bsRows);
    }

    return batch;
  }
}
