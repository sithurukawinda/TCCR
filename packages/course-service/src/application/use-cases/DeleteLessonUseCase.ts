import { createHttpError }   from '@shared/errors';
import { ILessonRepository }  from '../../domain/repositories/ILessonRepository';

export class DeleteLessonUseCase {
  constructor(private readonly lessonRepo: ILessonRepository) {}

  async execute(id: string): Promise<void> {
    const lesson = await this.lessonRepo.findById(id);
    if (!lesson || lesson.deletedAt) throw createHttpError(404, 'LESSON_NOT_FOUND', 'Lesson not found.');
    await this.lessonRepo.softDelete(id);
  }
}
