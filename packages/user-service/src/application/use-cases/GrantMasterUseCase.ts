import { createHttpError }    from '@shared/errors';
import { IUserRepository }    from '../../domain/repositories/IUserRepository';
import { FirebaseAuthClient } from '../../infrastructure/clients/FirebaseAuthClient';

export class GrantMasterUseCase {
  constructor(
    private readonly userRepo:   IUserRepository,
    private readonly authClient: FirebaseAuthClient,
  ) {}

  async execute(targetUid: string, callerUid: string): Promise<void> {
    if (targetUid === callerUid) {
      throw createHttpError(403, 'FORBIDDEN', 'You cannot grant master to yourself.');
    }

    const user = await this.userRepo.findById(targetUid);
    if (!user) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');

    if (user.roles.includes('master')) return; // idempotent

    await this.userRepo.atomicAddRole(targetUid, 'master');
    await this.authClient.addRoleToUser(targetUid, 'master');
  }
}
