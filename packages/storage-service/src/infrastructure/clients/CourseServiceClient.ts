import { createInternalClient } from '@shared/internal-http-client';
import { config }               from '../../config';

export class CourseServiceClient {
  private readonly http = createInternalClient(config.serviceCourseUrl, config.internalServiceKey);

  async getSubject(subjectId: string): Promise<{ id: string; courseId: string } | null> {
    try {
      const res = await this.http.get<{ id: string; courseId: string }>(`/internal/subjects/${subjectId}`);
      return res.data;
    } catch {
      return null;
    }
  }
}
