import { createHttpError }      from '@shared/errors';
import { OutboxEventPublisher } from '@shared/events';
import { IUserRepository }      from '../../domain/repositories/IUserRepository';
import { FirebaseAuthClient }   from '../../infrastructure/clients/FirebaseAuthClient';
import { User }                 from '../../domain/entities/User';

export class RevokeReportsFullAccessUseCase {
  constructor(
    private readonly userRepo:   IUserRepository,
    private readonly authClient: FirebaseAuthClient,
    private readonly outbox:     OutboxEventPublisher,
  ) {}

  async execute(targetUid: string, callerUid: string, requestId: string): Promise<User> {
    const user = await this.userRepo.findById(targetUid);
    if (!user) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');

    user.reportsFullAccess = false;
    await this.userRepo.update(user);
    await this.authClient.setReportsFullAccess(targetUid, false);

    await this.outbox.publishWithBatch({
      type:    'audit.action',
      payload: {
        actorUid:   callerUid,
        actorEmail: '',
        action:     'REVOKE_REPORTS_FULL_ACCESS',
        category:   'user',
        targetType: 'user',
        targetId:   targetUid,
      },
      requestId,
    });

    return user;
  }
}
