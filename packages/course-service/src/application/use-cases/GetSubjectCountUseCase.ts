import { createHttpError }     from '@shared/errors';
import { ICourseRepository }   from '../../domain/repositories/ICourseRepository';
import { ISemesterRepository } from '../../domain/repositories/ISemesterRepository';

export class GetSubjectCountUseCase {
  constructor(
    private readonly courseRepo:   ICourseRepository,
    private readonly semesterRepo: ISemesterRepository,
  ) {}

  async execute(courseId: string): Promise<{ subjectCount: number }> {
    const course = await this.courseRepo.findById(courseId);
    if (!course) throw createHttpError(404, 'COURSE_NOT_FOUND', 'Course not found.');

    const semesters    = await this.semesterRepo.findByCourseId(courseId);
    const subjectCount = semesters.reduce((sum, s) => sum + s.subjectCount, 0);
    return { subjectCount };
  }
}
