import { createHttpError }              from '@shared/errors';
import { IVideoProgressRepository }     from '../../domain/repositories/IVideoProgressRepository';
import { VideoProgress }                from '../../domain/entities/VideoProgress';

export interface SaveVideoPositionResult {
  lessonId:       string;
  watchedSeconds: number;
  updatedAt:      string;
}

export class SaveVideoPositionUseCase {
  constructor(private readonly repo: IVideoProgressRepository) {}

  async execute(
    studentUid:     string,
    lessonId:       string,
    courseId:       string,
    watchedSeconds: number,
  ): Promise<SaveVideoPositionResult> {
    if (watchedSeconds < 0) {
      throw createHttpError(400, 'VALIDATION_ERROR', 'watchedSeconds must be 0 or greater.');
    }

    const now = new Date().toISOString();
    const existing = await this.repo.findByStudentAndLesson(studentUid, lessonId);

    let record: VideoProgress;
    if (existing) {
      existing.update(watchedSeconds);
      record = existing;
    } else {
      record = new VideoProgress({
        id:             `${studentUid}_${lessonId}`,
        studentUid,
        lessonId,
        courseId,
        watchedSeconds,
        updatedAt:      now,
      });
    }

    await this.repo.save(record);

    return {
      lessonId,
      watchedSeconds: record.watchedSeconds,
      updatedAt:      record.updatedAt,
    };
  }
}
