import { createHttpError }            from '@shared/errors';
import { ILessonProgressRepository }  from '../../domain/repositories/ILessonProgressRepository';
import { LessonProgress }             from '../../domain/entities/LessonProgress';
import { CourseServiceClient }        from '../../infrastructure/clients/CourseServiceClient';
import { EnrollmentServiceClient }    from '../../infrastructure/clients/EnrollmentServiceClient';
import { MarkSubjectCompleteUseCase } from './MarkSubjectCompleteUseCase';

export interface MarkLessonCompleteInput {
  studentUid: string;
  lessonId:   string;
  courseId:   string;
  subjectId:  string;
  semesterId: string;
  batchId:    string | null;
}

export interface MarkLessonCompleteResult {
  lessonId:             string;
  subjectId:            string;
  courseId:             string;
  completedAt:          string;
  subjectAutoCompleted: boolean;
}

export class MarkLessonCompleteUseCase {
  constructor(
    private readonly lessonProgressRepo:  ILessonProgressRepository,
    private readonly courseClient:        CourseServiceClient,
    private readonly enrollmentClient:    EnrollmentServiceClient,
    private readonly markSubjectComplete: MarkSubjectCompleteUseCase,
  ) {}

  async execute(input: MarkLessonCompleteInput, requestId: string): Promise<MarkLessonCompleteResult> {
    // 1. Verify approved enrollment
    const enrolled = await this.enrollmentClient.isEnrolled(input.studentUid, input.courseId);
    if (!enrolled) {
      throw createHttpError(403, 'NOT_ENROLLED', 'An approved enrollment is required to mark lessons complete.');
    }

    // 2. Validate lesson exists and belongs to the stated subject/course
    const lesson = await this.courseClient.getLesson(input.lessonId);
    if (!lesson) {
      throw createHttpError(404, 'LESSON_NOT_FOUND', 'Lesson not found.');
    }
    if (lesson.courseId !== input.courseId || lesson.subjectId !== input.subjectId) {
      throw createHttpError(
        400,
        'LESSON_MISMATCH',
        'lessonId does not belong to the stated courseId / subjectId.',
      );
    }

    // 3. Idempotent — already complete, return existing record unchanged
    const existing = await this.lessonProgressRepo.findByStudentAndLesson(input.studentUid, input.lessonId);
    if (existing) {
      return {
        lessonId:             existing.lessonId,
        subjectId:            existing.subjectId,
        courseId:             existing.courseId,
        completedAt:          existing.completedAt,
        subjectAutoCompleted: false,
      };
    }

    // 4. Persist lesson completion
    const progress = LessonProgress.createNew(
      input.studentUid,
      input.lessonId,
      input.subjectId,
      input.courseId,
      input.semesterId,
      input.batchId,
    );
    await this.lessonProgressRepo.save(progress);

    // 5. Auto-rollup: mark subject complete when every lesson in the subject is done
    const [totalLessons, completedInSubject] = await Promise.all([
      this.courseClient.getLessonCount(input.subjectId),
      this.lessonProgressRepo.findBySubjectAndStudent(input.subjectId, input.studentUid),
    ]);

    let subjectAutoCompleted = false;
    if (totalLessons > 0 && completedInSubject.length >= totalLessons) {
      await this.markSubjectComplete.execute(
        {
          studentUid: input.studentUid,
          subjectId:  input.subjectId,
          courseId:   input.courseId,
          semesterId: input.semesterId,
        },
        requestId,
      );
      subjectAutoCompleted = true;
    }

    return {
      lessonId:    progress.lessonId,
      subjectId:   progress.subjectId,
      courseId:    progress.courseId,
      completedAt: progress.completedAt,
      subjectAutoCompleted,
    };
  }
}
