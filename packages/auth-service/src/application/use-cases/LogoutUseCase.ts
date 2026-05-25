import { getAuth } from 'firebase-admin/auth';

export class LogoutUseCase {
  async execute(uid: string): Promise<void> {
    await getAuth().revokeRefreshTokens(uid);
  }
}
