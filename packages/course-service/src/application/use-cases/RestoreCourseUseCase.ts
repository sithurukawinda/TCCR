import { createHttpError }   from '@shared/errors';
import { ICourseRepository } from '../../domain/repositories/ICourseRepository';
import { Course }            from '../../domain/entities/Course';

export class RestoreCourseUseCase {
  constructor(private readonly courseRepo: ICourseRepository) {}

  async execute(id: string): Promise<Course> {
    const course = await this.courseRepo.findById(id);
    if (!course) throw createHttpError(404, 'COURSE_NOT_FOUND', 'Course not found.');

    course.restore(); // throws 409 if not ARCHIVED
    await this.courseRepo.update(course);
    return course;
  }
}
