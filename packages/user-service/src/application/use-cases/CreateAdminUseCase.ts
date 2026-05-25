import { createHttpError }      from '@shared/errors';
import { OutboxEventPublisher } from '@shared/events';
import { IUserRepository }      from '../../domain/repositories/IUserRepository';
import { FirebaseAuthClient }   from '../../infrastructure/clients/FirebaseAuthClient';
import { User }                 from '../../domain/entities/User';

export interface CreateAdminInput {
  firstName:       string;
  lastName:        string;
  email:           string;
  initialPassword: string;
}

export class CreateAdminUseCase {
  constructor(
    private readonly userRepo:   IUserRepository,
    private readonly authClient: FirebaseAuthClient,
    private readonly outbox:     OutboxEventPublisher,
  ) {}

  async execute(input: CreateAdminInput, requestId: string): Promise<User> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) throw createHttpError(409, 'EMAIL_EXISTS', 'Email address already registered.');

    const uid = await this.authClient.createUser({
      email:       input.email,
      password:    input.initialPassword,
      displayName: `${input.firstName} ${input.lastName}`,
    });

    try {
      await this.authClient.setCustomClaims(uid, { role: 'admin', roles: ['admin'] });

      const now  = new Date().toISOString();
      const user = new User({
        uid,
        email:           input.email,
        firstName:       input.firstName,
        lastName:        input.lastName,
        role:            'admin',
        roles:           ['admin'],
        status:          'approved',
        profilePhotoUrl: null,
        createdAt:       now,
        updatedAt:       now,
        deletedAt:       null,
      });

      await this.userRepo.create(user);

      await this.outbox.publishWithBatch({
        type:    'admin.created',
        payload: {
          uid,
          email:           input.email,
          firstName:       input.firstName,
          lastName:        input.lastName,
          initialPassword: input.initialPassword,
        },
        requestId,
      });

      return user;
    } catch (err) {
      await this.authClient.deleteUser(uid).catch(() => undefined);
      throw err;
    }
  }
}
