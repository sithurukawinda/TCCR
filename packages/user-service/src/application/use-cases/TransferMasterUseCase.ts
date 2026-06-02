import { createHttpError }    from '@shared/errors';
import { OutboxEventPublisher } from '@shared/events';
import { IUserRepository }    from '../../domain/repositories/IUserRepository';
import { FirebaseAuthClient } from '../../infrastructure/clients/FirebaseAuthClient';

/**
 * Transfers the master position from the caller to the target user.
 * Caller loses master; target gains master.
 * Only a current master can invoke this — super_admin cannot.
 */
export class TransferMasterUseCase {
  constructor(
    private readonly userRepo:   IUserRepository,
    private readonly authClient: FirebaseAuthClient,
    private readonly outbox:     OutboxEventPublisher,
  ) {}

  async execute(targetUid: string, callerUid: string, requestId: string): Promise<void> {
    if (targetUid === callerUid) {
      throw createHttpError(403, 'FORBIDDEN', 'You cannot transfer master to yourself.');
    }

    const target = await this.userRepo.findById(targetUid);
    if (!target) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');

    // Step 1: Grant master to target (idempotent if they already have it)
    if (!target.roles.includes('master')) {
      await this.userRepo.atomicAddRole(targetUid, 'master');
      await this.authClient.addRoleToUser(targetUid, 'master');
    }

    // Step 2: Remove master from caller (self-demotion)
    await this.userRepo.atomicRemoveRole(callerUid, 'master');
    await this.authClient.removeRoleFromUser(callerUid, 'master');

    // Audit trail
    await this.outbox.publishWithBatch({
      type: 'audit.action',
      payload: {
        actorUid:   callerUid,
        actorEmail: '',
        action:     'MASTER_POSITION_TRANSFERRED',
        category:   'user',
        targetType: 'user',
        targetId:   targetUid,
      },
      requestId,
    });
  }
}
