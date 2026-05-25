import { v4 as uuidv4 }         from 'uuid';
import { createHttpError }       from '@shared/errors';
import { ICourseRepository }     from '../../domain/repositories/ICourseRepository';
import { ISemesterRepository }   from '../../domain/repositories/ISemesterRepository';
import { Semester }              from '../../domain/entities/Semester';

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

    return semester;
  }
}
