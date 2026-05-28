import { v4 as uuidv4 }                    from 'uuid';
import { createHttpError }                  from '@shared/errors';
import { ICourseRepository }               from '../../domain/repositories/ICourseRepository';
import { ISemesterRepository }             from '../../domain/repositories/ISemesterRepository';
import { IBatchRepository }                from '../../domain/repositories/IBatchRepository';
import { IBatchSemesterRepository }        from '../../domain/repositories/IBatchSemesterRepository';
import { Semester }                        from '../../domain/entities/Semester';
import { BatchSemester }                   from '../../domain/entities/BatchSemester';

export interface CreateSemesterInput {
  courseId:  string;
  title:     string;
  openDate?: string | null;
  endDate?:  string | null;
}

export class CreateSemesterUseCase {
  constructor(
    private readonly courseRepo:   ICourseRepository,
    private readonly semesterRepo: ISemesterRepository,
    private readonly batchRepo:    IBatchRepository,
    private readonly bsRepo:       IBatchSemesterRepository,
  ) {}

  async execute(input: CreateSemesterInput): Promise<Semester> {
    const course = await this.courseRepo.findById(input.courseId);
    if (!course) throw createHttpError(404, 'COURSE_NOT_FOUND', 'Course not found.');

    const existing = await this.semesterRepo.findByCourseId(input.courseId);
    const now      = new Date().toISOString();
    const semester = new Semester({
      id:           uuidv4(),
      courseId:     input.courseId,
      title:        input.title,
      subjectCount: 0,
      order:        existing.length + 1,
      openDate:     input.openDate  ?? null,
      endDate:      input.endDate   ?? null,
      status:       'active',
      deletedAt:    null,
      createdAt:    now,
      updatedAt:    now,
    });

    await this.semesterRepo.create(semester);

    course.semesterCount += 1;
    course.updatedAt = now;
    await this.courseRepo.update(course);

    // Auto-create a BatchSemester row (null dates) for every existing batch of this course
    const batches = await this.batchRepo.findByCourseId(input.courseId);
    if (batches.length > 0) {
      const bsRows = batches.map(b => new BatchSemester({
        id:         `${b.id}_${semester.id}`,
        batchId:    b.id,
        semesterId: semester.id,
        courseId:   input.courseId,
        openDate:   null,
        endDate:    null,
        createdAt:  now,
        updatedAt:  now,
      }));
      await this.bsRepo.upsertMany(bsRows);
    }

    return semester;
  }
}
