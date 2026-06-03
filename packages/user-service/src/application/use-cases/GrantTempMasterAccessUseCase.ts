import { createHttpError }      from '@shared/errors';
import { OutboxEventPublisher } from '@shared/events';
import { IUserRepository }      from '../../domain/repositories/IUserRepository';
import { FirebaseAuthClient }   from '../../infrastructure/clients/FirebaseAuthClient';
import { User }                 from '../../domain/entities/User';

export interface GrantTempMasterAccessInput {
  targetUid:  string;
  callerUid:  string;
  expiresAt:  string; // ISO 8601 timestamp — must be in the future
  requestId:  string;
}

export class GrantTempMasterAccessUseCase {
  constructor(
    private readonly userRepo:   IUserRepository,
    private readonly authClient: FirebaseAuthClient,
    private readonly outbox:     OutboxEventPublisher,
  ) {}

  async execute(input: GrantTempMasterAccessInput): Promise<User> {
    const { targetUid, callerUid, expiresAt, requestId } = input;

    const user = await this.userRepo.findById(targetUid);
    if (!user) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');

    if (!user.roles.includes('g12')) {
      throw createHttpError(400, 'INVALID_TARGET', 'Temporary Master Access can only be granted to a G12 user.');
    }

    if (user.roles.includes('master')) {
      throw createHttpError(400, 'ALREADY_MASTER', 'User is already a Master — Temporary Master Access is not needed.');
    }

    if (new Date(expiresAt) <= new Date()) {
      throw createHttpError(400, 'INVALID_EXPIRY', 'expiresAt must be a future date.');
    }

    const grantedAt = new Date().toISOString();
    user.temporaryMasterAccess = { grantedBy: callerUid, grantedAt, expiresAt };
    await this.userRepo.update(user);
    await this.authClient.setTempMasterAccess(targetUid, expiresAt);

    await this.outbox.publishWithBatch({
      type:    'audit.action',
      payload: {
        actorUid:   callerUid,
        actorEmail: '',
        action:     'GRANT_TEMP_MASTER_ACCESS',
        category:   'user',
        targetType: 'user',
        targetId:   targetUid,
        grantedAt,
        expiresAt,
      },
      requestId,
    });

    return user;
  }
}
