import { createHttpError }      from '@shared/errors';
import { OutboxEventPublisher } from '@shared/events';
import { IUserRepository }      from '../../domain/repositories/IUserRepository';
import { FirebaseAuthClient }   from '../../infrastructure/clients/FirebaseAuthClient';
import { User }                 from '../../domain/entities/User';

export class RevokeTempMasterAccessUseCase {
  constructor(
    private readonly userRepo:   IUserRepository,
    private readonly authClient: FirebaseAuthClient,
    private readonly outbox:     OutboxEventPublisher,
  ) {}

  async execute(targetUid: string, callerUid: string, requestId: string): Promise<User> {
    const user = await this.userRepo.findById(targetUid);
    if (!user) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');

    if (!user.temporaryMasterAccess) {
      throw createHttpError(400, 'NO_TEMP_ACCESS', 'This user has no active Temporary Master Access to revoke.');
    }

    const originalExpiresAt = user.temporaryMasterAccess.expiresAt;
    const revokedAt         = new Date().toISOString();

    user.temporaryMasterAccess = null;
    await this.userRepo.update(user);
    await this.authClient.clearTempMasterAccess(targetUid);

    await this.outbox.publishWithBatch({
      type:    'audit.action',
      payload: {
        actorUid:          callerUid,
        actorEmail:        '',
        action:            'REVOKE_TEMP_MASTER_ACCESS',
        category:          'user',
        targetType:        'user',
        targetId:          targetUid,
        revokedAt,
        originalExpiresAt,
      },
      requestId,
    });

    return user;
  }
}
