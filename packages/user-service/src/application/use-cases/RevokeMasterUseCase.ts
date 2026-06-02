import { createHttpError }    from '@shared/errors';
import { IUserRepository }    from '../../domain/repositories/IUserRepository';
import { FirebaseAuthClient } from '../../infrastructure/clients/FirebaseAuthClient';

export class RevokeMasterUseCase {
  constructor(
    private readonly userRepo:   IUserRepository,
    private readonly authClient: FirebaseAuthClient,
  ) {}

  async execute(targetUid: string, callerUid: string): Promise<void> {
    if (targetUid === callerUid) {
      throw createHttpError(403, 'FORBIDDEN', 'You cannot revoke master from yourself.');
    }

    const user = await this.userRepo.findById(targetUid);
    if (!user) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');

    if (!user.roles.includes('master')) return; // idempotent — already absent

    await this.userRepo.atomicRemoveRole(targetUid, 'master');
    await this.authClient.removeRoleFromUser(targetUid, 'master');
  }
}
