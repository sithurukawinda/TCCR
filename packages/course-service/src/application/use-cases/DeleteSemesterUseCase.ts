import { createHttpError }               from '@shared/errors';
import { ICourseRepository }             from '../../domain/repositories/ICourseRepository';
import { ISemesterRepository }           from '../../domain/repositories/ISemesterRepository';
import { IBatchSemesterRepository }      from '../../domain/repositories/IBatchSemesterRepository';

export class DeleteSemesterUseCase {
  constructor(
    private readonly courseRepo:   ICourseRepository,
    private readonly semesterRepo: ISemesterRepository,
    private readonly bsRepo:       IBatchSemesterRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const semester = await this.semesterRepo.findById(id);
    if (!semester) throw createHttpError(404, 'SEMESTER_NOT_FOUND', 'Semester not found.');

    await this.semesterRepo.softDelete(id);

    // Cascade: remove all BatchSemester rows for this semester
    await this.bsRepo.deleteBySemesterId(id);

    const course = await this.courseRepo.findById(semester.courseId);
    if (course && course.semesterCount > 0) {
      course.semesterCount -= 1;
      course.updatedAt = new Date().toISOString();
      await this.courseRepo.update(course);
    }
  }
}
