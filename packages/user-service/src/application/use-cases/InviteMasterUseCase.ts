import { createHttpError }      from '@shared/errors';
import { OutboxEventPublisher } from '@shared/events';
import { IUserRepository }      from '../../domain/repositories/IUserRepository';
import { FirebaseAuthClient }   from '../../infrastructure/clients/FirebaseAuthClient';
import { User }                 from '../../domain/entities/User';

export interface InviteMasterInput {
  firstName:       string;
  lastName:        string;
  email:           string;
  initialPassword: string;
}

export class InviteMasterUseCase {
  constructor(
    private readonly userRepo:   IUserRepository,
    private readonly authClient: FirebaseAuthClient,
    private readonly outbox:     OutboxEventPublisher,
  ) {}

  async execute(input: InviteMasterInput, requestId: string): Promise<User> {
    // Singleton guard — block if ANY master exists (active or suspended)
    const existing = await this.userRepo.findAll({ roleInArray: 'master', limit: 5 });
    if (existing.items.length > 0) {
      throw createHttpError(
        409,
        'MASTER_ALREADY_EXISTS',
        'A Master already exists. Delete the current Master before creating a new one.',
      );
    }

    const existingEmail = await this.userRepo.findByEmail(input.email);
    if (existingEmail) throw createHttpError(409, 'EMAIL_EXISTS', 'Email address already registered.');

    const uid = await this.authClient.createUser({
      email:         input.email,
      password:      input.initialPassword,
      displayName:   `${input.firstName} ${input.lastName}`,
      emailVerified: true,
    });

    try {
      await this.authClient.setCustomClaims(uid, {
        role:  'member',
        roles: ['member', 'g12', 'master'],
      });

      const now  = new Date().toISOString();
      const user = new User({
        uid,
        email:           input.email,
        firstName:       input.firstName,
        lastName:        input.lastName,
        role:            'member',
        roles:           ['member', 'g12', 'master'],
        status:          'approved',
        profilePhotoUrl: null,
        createdAt:       now,
        updatedAt:       now,
        deletedAt:       null,
      });

      await this.userRepo.create(user);

      let passwordResetUrl: string | null = null;
      try {
        passwordResetUrl = await this.authClient.generatePasswordResetLink(input.email);
      } catch {
        // Non-fatal — emulator quirk
      }

      await this.outbox.publishWithBatch({
        type:    'admin.created',
        payload: {
          uid,
          email:           input.email,
          firstName:       input.firstName,
          lastName:        input.lastName,
          initialPassword: input.initialPassword,
          role:            'master',
          passwordResetUrl,
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
