import { IProgressRepository }        from '../../domain/repositories/IProgressRepository';
import { ILessonProgressRepository }  from '../../domain/repositories/ILessonProgressRepository';
import { CourseServiceClient }        from '../../infrastructure/clients/CourseServiceClient';

export interface CourseProgressResult {
  courseId:                string;
  studentUid:              string;
  completedCount:          number;
  pendingCount:            number;
  totalSubjects:           number;
  completionPercent:       number;
  lastAccessedSubjectId:   string | null;
  lastAccessedAt:          string | null;
  // Lesson-level fields (V2)
  completedLessonIds:      string[];
  totalLessons:            number;
  lessonCompletionPercent: number;
}

export class ComputeCourseProgressUseCase {
  constructor(
    private readonly progressRepo:       IProgressRepository,
    private readonly lessonProgressRepo: ILessonProgressRepository,
    private readonly courseClient:       CourseServiceClient,
  ) {}

  async execute(studentUid: string, courseId: string): Promise<CourseProgressResult> {
    const [records, totalSubjects, lessonRecords, totalLessons] = await Promise.all([
      this.progressRepo.findByCourseAndStudent(courseId, studentUid),
      this.courseClient.getSubjectCount(courseId),
      this.lessonProgressRepo.findByCourseAndStudent(courseId, studentUid),
      this.courseClient.getCourseLessonCount(courseId),
    ]);

    const completedCount = records.filter(r => r.state === 'completed').length;
    const pendingCount   = totalSubjects - completedCount;
    const completionPercent = totalSubjects === 0
      ? 0
      : Math.round((completedCount / totalSubjects) * 1000) / 10;

    const lastAccessed = records
      .filter(r => r.lastAccessedAt !== null)
      .sort((a, b) => (b.lastAccessedAt ?? '').localeCompare(a.lastAccessedAt ?? ''))[0];

    const completedLessonIds      = lessonRecords.map(r => r.lessonId);
    const lessonCompletionPercent = totalLessons === 0
      ? 0
      : Math.round((completedLessonIds.length / totalLessons) * 100);

    return {
      courseId,
      studentUid,
      completedCount,
      pendingCount,
      totalSubjects,
      completionPercent,
      lastAccessedSubjectId:   lastAccessed?.subjectId  ?? null,
      lastAccessedAt:          lastAccessed?.lastAccessedAt ?? null,
      completedLessonIds,
      totalLessons,
      lessonCompletionPercent,
    };
  }
}
