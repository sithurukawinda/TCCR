import { createHttpError }      from '@shared/errors';
import { OutboxEventPublisher } from '@shared/events';
import { IUserRepository }      from '../../domain/repositories/IUserRepository';
import { FirebaseAuthClient }   from '../../infrastructure/clients/FirebaseAuthClient';

export class DeleteMasterUseCase {
  constructor(
    private readonly userRepo:   IUserRepository,
    private readonly authClient: FirebaseAuthClient,
    private readonly outbox:     OutboxEventPublisher,
  ) {}

  async execute(uid: string, callerUid: string, callerEmail: string, requestId: string): Promise<void> {
    const user = await this.userRepo.findById(uid);
    if (!user) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');
    if (!user.roles.includes('master')) {
      throw createHttpError(404, 'USER_NOT_FOUND', 'Master user not found.');
    }

    const deletedEmail = user.email;

    await this.userRepo.hardDelete(uid);
    await this.authClient.deleteUser(uid);

    await this.outbox.publishWithBatch({
      type:    'audit.action',
      payload: {
        actorUid:     callerUid,
        actorEmail:   callerEmail,
        action:       'MASTER_DELETED',
        category:     'user',
        targetType:   'user',
        targetId:     uid,
        deletedEmail,
      },
      requestId,
    });
  }
}
