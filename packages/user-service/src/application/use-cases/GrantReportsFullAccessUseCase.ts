import { createHttpError }      from '@shared/errors';
import { OutboxEventPublisher } from '@shared/events';
import { IUserRepository }      from '../../domain/repositories/IUserRepository';
import { FirebaseAuthClient }   from '../../infrastructure/clients/FirebaseAuthClient';
import { User }                 from '../../domain/entities/User';

export class GrantReportsFullAccessUseCase {
  constructor(
    private readonly userRepo:   IUserRepository,
    private readonly authClient: FirebaseAuthClient,
    private readonly outbox:     OutboxEventPublisher,
  ) {}

  async execute(targetUid: string, callerUid: string, requestId: string): Promise<User> {
    const user = await this.userRepo.findById(targetUid);
    if (!user) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');

    if (!user.roles.includes('g12')) {
      throw createHttpError(
        400,
        'INVALID_TARGET',
        'REPORTS_FULL_ACCESS can only be granted to a G12 user.',
      );
    }

    if (user.roles.includes('master')) {
      throw createHttpError(
        400,
        'ALREADY_MASTER',
        'User is already a Master — REPORTS_FULL_ACCESS is not needed.',
      );
    }

    user.reportsFullAccess = true;
    await this.userRepo.update(user);
    await this.authClient.setReportsFullAccess(targetUid, true);

    await this.outbox.publishWithBatch({
      type:    'audit.action',
      payload: {
        actorUid:   callerUid,
        actorEmail: '',
        action:     'GRANT_REPORTS_FULL_ACCESS',
        category:   'user',
        targetType: 'user',
        targetId:   targetUid,
      },
      requestId,
    });

    return user;
  }
}
