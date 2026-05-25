import { createInternalClient } from '@shared/internal-http-client';
import { config }               from '../../config';

export class CourseServiceClient {
  private readonly http = createInternalClient(config.serviceCourseUrl, config.internalServiceKey);

  async getSubjectCount(courseId: string): Promise<number> {
    const res = await this.http.get<{ subjectCount: number }>(`/internal/courses/${courseId}/subject-count`);
    return res.data.subjectCount;
  }
}
