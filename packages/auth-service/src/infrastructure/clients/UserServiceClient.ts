import { createInternalClient } from '@shared/internal-http-client';
import { config }               from '../../config';

export class UserServiceClient {
  private readonly http = createInternalClient(config.serviceUserUrl, config.internalServiceKey);

  async emailExists(email: string): Promise<boolean> {
    const res = await this.http.post<{ exists: boolean }>('/internal/users/exists', { email });
    return res.data.exists;
  }
}
