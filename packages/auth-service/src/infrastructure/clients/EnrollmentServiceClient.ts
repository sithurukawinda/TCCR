import { createInternalClient } from '@shared/internal-http-client';
import { config }               from '../../config';

export interface CreateRegistrationPayload {
  studentUid: string;
  email:      string;
  firstName:  string;
  lastName:   string;
}

export class EnrollmentServiceClient {
  private readonly http = createInternalClient(config.serviceEnrollUrl, config.internalServiceKey);

  async createRegistration(payload: CreateRegistrationPayload): Promise<void> {
    await this.http.post('/internal/enrollments/registrations', payload);
  }
}
