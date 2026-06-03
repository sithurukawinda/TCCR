import { createHttpError }      from '@shared/errors';
import { OutboxEventPublisher } from '@shared/events';
import { IUserRepository }      from '../../domain/repositories/IUserRepository';
import { FirebaseAuthClient }   from '../../infrastructure/clients/FirebaseAuthClient';
import { User, UserRole }       from '../../domain/entities/User';

const ELIGIBLE_ROLES: UserRole[] = ['member', 'student', 'g12'];
const FORBIDDEN_ROLES: UserRole[] = ['leader', 'admin', 'super_admin'];

export class AssignMasterUseCase {
  constructor(
    private readonly userRepo:   IUserRepository,
    private readonly authClient: FirebaseAuthClient,
    private readonly outbox:     OutboxEventPublisher,
  ) {}

  async execute(targetUid: string, callerUid: string, requestId: string): Promise<User> {
    if (targetUid === callerUid) {
      throw createHttpError(400, 'INVALID_TARGET', 'You cannot assign the master role to yourself.');
    }

    // Singleton guard — block if ANY master exists (active or suspended)
    const existing = await this.userRepo.findAll({ roleInArray: 'master', limit: 5 });
    if (existing.items.length > 0) {
      throw createHttpError(
        409,
        'MASTER_ALREADY_EXISTS',
        'A Master already exists. Delete the current Master before assigning a new one.',
      );
    }

    const user = await this.userRepo.findById(targetUid);
    if (!user) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');

    // Target must be a Member, Student, or G12 — not a Leader, Admin, or Super Admin
    const hasForbiddenRole = FORBIDDEN_ROLES.some(r => user.roles.includes(r));
    if (hasForbiddenRole) {
      throw createHttpError(
        400,
        'INVALID_TARGET',
        `Master can only be assigned to a Member, Student, or G12 user. This user holds a role that is not eligible: ${user.roles.filter(r => FORBIDDEN_ROLES.includes(r as UserRole)).join(', ')}.`,
      );
    }

    // Ensure user holds at least one eligible role
    const hasEligibleRole = ELIGIBLE_ROLES.some(r => user.roles.includes(r));
    if (!hasEligibleRole) {
      throw createHttpError(
        400,
        'INVALID_TARGET',
        'Master can only be assigned to a Member, Student, or G12 user.',
      );
    }

    user.addRole('g12');
    user.addRole('master');
    await this.userRepo.update(user);
    await this.authClient.addRoleToUser(targetUid, 'g12');
    await this.authClient.addRoleToUser(targetUid, 'master');

    await this.outbox.publishWithBatch({
      type:    'admin.created',
      payload: {
        uid:       targetUid,
        email:     user.email,
        firstName: user.firstName,
        lastName:  user.lastName,
        promoted:  true,
        role:      'master',
      },
      requestId,
    });

    return user;
  }
}
