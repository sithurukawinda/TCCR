import { createHttpError }    from '@shared/errors';
import { IUserRepository }    from '../../domain/repositories/IUserRepository';
import { FirebaseAuthClient } from '../../infrastructure/clients/FirebaseAuthClient';
import { OutboxEventPublisher } from '@shared/events';
import { User }               from '../../domain/entities/User';

export class SuspendUserUseCase {
  constructor(
    private readonly userRepo:   IUserRepository,
    private readonly authClient: FirebaseAuthClient,
    private readonly outbox:     OutboxEventPublisher,
  ) {}

  async execute(uid: string, requestId: string): Promise<User> {
    const user = await this.userRepo.findById(uid);
    if (!user) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');

    user.suspend();
    await this.userRepo.update(user);
    await this.authClient.disableUser(uid);

    if (user.role === 'admin') {
      await this.outbox.publishWithBatch({
        type:      'admin.suspended',
        payload:   { uid, email: user.email, firstName: user.firstName, lastName: user.lastName },
        requestId,
      });
    }

    return user;
  }
}
