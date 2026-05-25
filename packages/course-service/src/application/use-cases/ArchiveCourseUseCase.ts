import { createHttpError }   from '@shared/errors';
import { ICourseRepository } from '../../domain/repositories/ICourseRepository';
import { Course }            from '../../domain/entities/Course';

export class ArchiveCourseUseCase {
  constructor(private readonly courseRepo: ICourseRepository) {}

  async execute(id: string): Promise<Course> {
    const course = await this.courseRepo.findById(id);
    if (!course) throw createHttpError(404, 'COURSE_NOT_FOUND', 'Course not found.');

    course.archive(); // throws 409 if not PUBLISHED
    await this.courseRepo.update(course);
    return course;
  }
}
