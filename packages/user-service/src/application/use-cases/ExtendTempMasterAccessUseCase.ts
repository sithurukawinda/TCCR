import { createHttpError }      from '@shared/errors';
import { OutboxEventPublisher } from '@shared/events';
import { IUserRepository }      from '../../domain/repositories/IUserRepository';
import { FirebaseAuthClient }   from '../../infrastructure/clients/FirebaseAuthClient';
import { User }                 from '../../domain/entities/User';

export interface ExtendTempMasterAccessInput {
  targetUid:     string;
  callerUid:     string;
  newExpiresAt:  string; // ISO 8601 timestamp — must be in the future
  requestId:     string;
}

export class ExtendTempMasterAccessUseCase {
  constructor(
    private readonly userRepo:   IUserRepository,
    private readonly authClient: FirebaseAuthClient,
    private readonly outbox:     OutboxEventPublisher,
  ) {}

  async execute(input: ExtendTempMasterAccessInput): Promise<User> {
    const { targetUid, callerUid, newExpiresAt, requestId } = input;

    const user = await this.userRepo.findById(targetUid);
    if (!user) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');

    if (!user.temporaryMasterAccess) {
      throw createHttpError(400, 'NO_TEMP_ACCESS', 'This user has no active Temporary Master Access to extend.');
    }

    if (new Date(newExpiresAt) <= new Date()) {
      throw createHttpError(400, 'INVALID_EXPIRY', 'newExpiresAt must be a future date.');
    }

    const previousExpiresAt = user.temporaryMasterAccess.expiresAt;
    const extendedAt        = new Date().toISOString();

    user.temporaryMasterAccess = {
      ...user.temporaryMasterAccess,
      expiresAt:  newExpiresAt,
      extendedAt,
    };

    await this.userRepo.update(user);
    await this.authClient.setTempMasterAccess(targetUid, newExpiresAt);

    await this.outbox.publishWithBatch({
      type:    'audit.action',
      payload: {
        actorUid:          callerUid,
        actorEmail:        '',
        action:            'EXTEND_TEMP_MASTER_ACCESS',
        category:          'user',
        targetType:        'user',
        targetId:          targetUid,
        previousExpiresAt,
        newExpiresAt,
        extendedAt,
      },
      requestId,
    });

    return user;
  }
}
