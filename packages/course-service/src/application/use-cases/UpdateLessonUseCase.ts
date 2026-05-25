import { createHttpError }   from '@shared/errors';
import { Lesson }             from '../../domain/entities/Lesson';
import { ILessonRepository }  from '../../domain/repositories/ILessonRepository';

export interface UpdateLessonInput {
  id:              string;
  title?:          string;
  description?:    string;
  youtubeVideoId?: string | null;
  attachmentIds?:  string[];
}

export class UpdateLessonUseCase {
  constructor(private readonly lessonRepo: ILessonRepository) {}

  async execute(input: UpdateLessonInput): Promise<Lesson> {
    const lesson = await this.lessonRepo.findById(input.id);
    if (!lesson || lesson.deletedAt) throw createHttpError(404, 'LESSON_NOT_FOUND', 'Lesson not found.');

    lesson.update({ title: input.title, description: input.description, youtubeVideoId: input.youtubeVideoId, attachmentIds: input.attachmentIds });
    await this.lessonRepo.update(lesson);
    return lesson;
  }
}
