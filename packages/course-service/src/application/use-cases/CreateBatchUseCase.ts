import { v4 as uuidv4 }        from 'uuid';
import { createHttpError }     from '@shared/errors';
import { ICourseRepository }   from '../../domain/repositories/ICourseRepository';
import { IBatchRepository }    from '../../domain/repositories/IBatchRepository';
import { Batch }               from '../../domain/entities/Batch';

export interface CreateBatchInput {
  name:            string;
  scheduledOpenAt: string | null;
  intakeStart:     string;
  intakeEnd:       string;
  capacity:        number | null;
}

export class CreateBatchUseCase {
  constructor(
    private readonly courseRepo: ICourseRepository,
    private readonly batchRepo:  IBatchRepository,
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
    return batch;
  }
}
