import { createHttpError }              from '@shared/errors';
import { IVideoProgressRepository }     from '../../domain/repositories/IVideoProgressRepository';
import { VideoProgress }                from '../../domain/entities/VideoProgress';
import { CourseServiceClient }          from '../../infrastructure/clients/CourseServiceClient';
import { UpdateLastAccessedUseCase }    from './UpdateLastAccessedUseCase';

export interface SaveVideoPositionResult {
  lessonId:       string;
  watchedSeconds: number;
  updatedAt:      string;
}

export class SaveVideoPositionUseCase {
  constructor(
    private readonly repo:               IVideoProgressRepository,
    private readonly courseClient:       CourseServiceClient,
    private readonly updateLastAccessed: UpdateLastAccessedUseCase,
  ) {}

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

    // Bump lastAccessedSubjectId + lastAccessedLessonId so the frontend can
    // resume on the correct lesson after a mid-watch logout.
    const lesson = await this.courseClient.getLesson(lessonId);
    if (lesson) {
      await this.updateLastAccessed.execute({
        studentUid,
        subjectId:  lesson.subjectId,
        courseId,
        semesterId: lesson.semesterId,
        lessonId,
      });
    }

    return {
      lessonId,
      watchedSeconds: record.watchedSeconds,
      updatedAt:      record.updatedAt,
    };
  }
}
