import { createInternalClient } from '@shared/internal-http-client';
import { config }                from '../../config';

export interface VerifiedFederatedPayload {
  email:       string;
  displayName: string;
  providerUid: string;
  providerId:  'google.com' | 'apple.com';
}

export class AuthServiceClient {
  private readonly http = createInternalClient(config.serviceAuthUrl, config.internalServiceKey);

  async verifyFederatedToken(provider: 'google' | 'apple', idToken: string): Promise<VerifiedFederatedPayload> {
    const res = await this.http.post<VerifiedFederatedPayload>('/internal/auth/verify-token', { provider, idToken });
    return res.data;
  }
}
