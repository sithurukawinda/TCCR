import { createInternalClient } from '@shared/internal-http-client';
import { config }               from '../../config';

export interface LessonMeta {
  id:        string;
  subjectId: string;
  courseId:  string;
  semesterId: string;
}

export class CourseServiceClient {
  private readonly http = createInternalClient(config.serviceCourseUrl, config.internalServiceKey);

  async getSubjectCount(courseId: string): Promise<number | null> {
    try {
      const res = await this.http.get<{ subjectCount: number }>(`/internal/courses/${courseId}/subject-count`);
      return res.data.subjectCount;
    } catch { return null; }
  }

  async getLesson(lessonId: string): Promise<LessonMeta | null> {
    try {
      const res = await this.http.get<LessonMeta>(`/internal/lessons/${lessonId}`);
      return res.data;
    } catch {
      return null;
    }
  }

  async getLessonCount(subjectId: string): Promise<number | null> {
    try {
      const res = await this.http.get<{ lessonCount: number }>(`/internal/subjects/${subjectId}/lesson-count`);
      return res.data.lessonCount;
    } catch { return null; }
  }

  async getCourseLessonCount(courseId: string): Promise<number | null> {
    try {
      const res = await this.http.get<{ lessonCount: number }>(`/internal/courses/${courseId}/lesson-count`);
      return res.data.lessonCount;
    } catch { return null; }
  }
}
