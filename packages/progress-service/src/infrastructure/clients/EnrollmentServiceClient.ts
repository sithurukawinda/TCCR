import { createInternalClient } from '@shared/internal-http-client';
import { config }               from '../../config';

export class EnrollmentServiceClient {
  private readonly http = createInternalClient(config.serviceEnrollmentUrl, config.internalServiceKey);

  async isEnrolled(studentUid: string, courseId: string): Promise<boolean> {
    const res = await this.http.get<{ enrolled: boolean }>(
      `/internal/enrollments/status?studentUid=${studentUid}&courseId=${courseId}`,
    );
    return res.data.enrolled;
  }
}
