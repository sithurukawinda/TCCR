import { createHttpError }     from '@shared/errors';
import { ICourseRepository }   from '../../domain/repositories/ICourseRepository';
import { ISemesterRepository } from '../../domain/repositories/ISemesterRepository';

export class DeleteSemesterUseCase {
  constructor(
    private readonly courseRepo:   ICourseRepository,
    private readonly semesterRepo: ISemesterRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const semester = await this.semesterRepo.findById(id);
    if (!semester) throw createHttpError(404, 'SEMESTER_NOT_FOUND', 'Semester not found.');

    await this.semesterRepo.softDelete(id);

    const course = await this.courseRepo.findById(semester.courseId);
    if (course && course.semesterCount > 0) {
      course.semesterCount -= 1;
      course.updatedAt = new Date().toISOString();
      await this.courseRepo.update(course);
    }
  }
}
