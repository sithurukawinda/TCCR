import { createHttpError }     from '@shared/errors';
import { OutboxEventPublisher } from '@shared/events';
import { IUserRepository }      from '../../domain/repositories/IUserRepository';
import { FirebaseAuthClient }   from '../../infrastructure/clients/FirebaseAuthClient';
import { User }                 from '../../domain/entities/User';

export interface PromoteToAdminInput {
  uid:       string;
  actorUid:  string;
  requestId: string;
}

export class PromoteToAdminUseCase {
  constructor(
    private readonly userRepo:   IUserRepository,
    private readonly authClient: FirebaseAuthClient,
    private readonly outbox:     OutboxEventPublisher,
  ) {}

  async execute(input: PromoteToAdminInput): Promise<User> {
    const user = await this.userRepo.findById(input.uid);
    if (!user) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');
    if (user.role !== 'student') {
      throw createHttpError(409, 'INVALID_ROLE', 'Only student accounts can be promoted to admin.');
    }

    // Retain the student role so the promoted admin can still act as a student
    await this.authClient.setCustomClaims(input.uid, { role: 'admin', roles: ['student', 'admin'] });

    // Rebuild user with updated role + status (role is readonly on entity)
    const promoted = new User({
      uid:             user.uid,
      email:           user.email,
      firstName:       user.firstName,
      lastName:        user.lastName,
      role:            'admin',
      roles:           ['student', 'admin'],
      status:          'approved',
      profilePhotoUrl: user.profilePhotoUrl,
      createdAt:       user.createdAt,
      updatedAt:       new Date().toISOString(),
      deletedAt:       user.deletedAt,
    });

    await this.userRepo.update(promoted);

    await this.outbox.publishWithBatch({
      type:      'admin.created',
      payload:   {
        uid:       promoted.uid,
        email:     promoted.email,
        firstName: promoted.firstName,
        lastName:  promoted.lastName,
        actorUid:  input.actorUid,
        promoted:  true,
      },
      requestId: input.requestId,
    });

    return promoted;
  }
}
