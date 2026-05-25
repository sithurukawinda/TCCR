import { createHttpError }      from '@shared/errors';
import { logger }               from '@shared/logger';
import { OutboxEventPublisher } from '@shared/events';
import { IUserRepository }      from '../../domain/repositories/IUserRepository';
import { FirebaseAuthClient }   from '../../infrastructure/clients/FirebaseAuthClient';
import { User, UserRole }       from '../../domain/entities/User';
import { config }               from '../../config';

export interface CreateUserDirectlyInput {
  firstName:       string;
  lastName:        string;
  email:           string;
  initialPassword: string;
  role:            'leader' | 'g12';
}

export class CreateUserDirectlyUseCase {
  constructor(
    private readonly userRepo:   IUserRepository,
    private readonly authClient: FirebaseAuthClient,
    private readonly outbox:     OutboxEventPublisher,
  ) {}

  async execute(input: CreateUserDirectlyInput, requestId: string): Promise<User> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) throw createHttpError(409, 'EMAIL_EXISTS', 'Email address already registered.');

    const roles: UserRole[] = ['member', input.role];

    const uid = await this.authClient.createUser({
      email:       input.email,
      password:    input.initialPassword,
      displayName: `${input.firstName} ${input.lastName}`,
    });

    try {
      await this.authClient.setCustomClaims(uid, { role: input.role, roles });

      const now  = new Date().toISOString();
      const user = new User({
        uid,
        email:           input.email,
        firstName:       input.firstName,
        lastName:        input.lastName,
        role:            input.role,
        roles,
        status:          'approved',
        profilePhotoUrl: null,
        createdAt:       now,
        updatedAt:       now,
        deletedAt:       null,
      });

      await this.userRepo.create(user);

      // Generate a Firebase password-reset link so the welcome email can include it.
      // If generation fails (e.g. emulator quirk) we still proceed — email falls back gracefully.
      const passwordResetUrl = await this.authClient
        .generatePasswordResetLink(input.email)
        .catch((e: unknown) => {
          logger.warn({ err: e, email: input.email }, 'Could not generate password reset link; continuing without it');
          return null;
        });

      await this.outbox.publishWithBatch({
        type:    'admin.created',
        payload: {
          uid,
          email:            input.email,
          firstName:        input.firstName,
          lastName:         input.lastName,
          initialPassword:  input.initialPassword,
          role:             input.role,
          passwordResetUrl,
          systemUrl:        config.appUrl,
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
