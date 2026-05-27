import { createHttpError }            from '@shared/errors';
import { ILessonProgressRepository }  from '../../domain/repositories/ILessonProgressRepository';
import { IProgressRepository }        from '../../domain/repositories/IProgressRepository';
import { CourseServiceClient }        from '../../infrastructure/clients/CourseServiceClient';

export interface UnmarkLessonCompleteInput {
  studentUid: string;
  lessonId:   string;
}

export class UnmarkLessonCompleteUseCase {
  constructor(
    private readonly lessonProgressRepo:  ILessonProgressRepository,
    private readonly subjectProgressRepo: IProgressRepository,
    private readonly courseClient:        CourseServiceClient,
  ) {}

  async execute(input: UnmarkLessonCompleteInput): Promise<void> {
    // 1. Verify a completion record exists
    const existing = await this.lessonProgressRepo.findByStudentAndLesson(
      input.studentUid,
      input.lessonId,
    );
    if (!existing) {
      throw createHttpError(404, 'LESSON_PROGRESS_NOT_FOUND', 'No completion record found for this lesson.');
    }

    // 2. Delete the lesson completion record
    await this.lessonProgressRepo.delete(input.studentUid, input.lessonId);

    // 3. Revert subject if it was auto-completed and is now incomplete
    const subjectProgress = await this.subjectProgressRepo.findByStudentAndSubject(
      input.studentUid,
      existing.subjectId,
    );

    if (subjectProgress?.state === 'completed') {
      const [totalLessons, remainingCompleted] = await Promise.all([
        this.courseClient.getLessonCount(existing.subjectId),
        this.lessonProgressRepo.findBySubjectAndStudent(existing.subjectId, input.studentUid),
      ]);

      if (remainingCompleted.length < totalLessons) {
        await this.subjectProgressRepo.revertCompletion(input.studentUid, existing.subjectId);
      }
    }
  }
}
