import { createHttpError }   from '@shared/errors';
import { ICourseRepository } from '../../domain/repositories/ICourseRepository';

export class HardDeleteCourseUseCase {
  constructor(private readonly courseRepo: ICourseRepository) {}

  async execute(id: string): Promise<void> {
    const course = await this.courseRepo.findById(id);
    if (!course) throw createHttpError(404, 'COURSE_NOT_FOUND', 'Course not found.');

    await this.courseRepo.hardDelete(id);
  }
}
