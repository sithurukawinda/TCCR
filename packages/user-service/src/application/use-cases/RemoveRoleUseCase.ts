import { createHttpError }    from '@shared/errors';
import { IUserRepository }    from '../../domain/repositories/IUserRepository';
import { FirebaseAuthClient } from '../../infrastructure/clients/FirebaseAuthClient';
import { UserRole }           from '../../domain/entities/User';

const VALID_ROLES: UserRole[] = ['member', 'student', 'leader', 'g12', 'admin', 'super_admin'];

export class RemoveRoleUseCase {
  constructor(
    private readonly userRepo:   IUserRepository,
    private readonly authClient: FirebaseAuthClient,
  ) {}

  async execute(uid: string, role: string): Promise<void> {
    if (!VALID_ROLES.includes(role as UserRole)) {
      throw createHttpError(400, 'INVALID_ROLE', `"${role}" is not a valid role.`);
    }
    if (role === 'member') {
      throw createHttpError(400, 'INVALID_ROLE', 'The member role cannot be removed.');
    }

    const user = await this.userRepo.findById(uid);
    if (!user) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');

    if (!user.roles.includes(role as UserRole)) return; // already absent — idempotent

    user.removeRole(role as UserRole);
    await this.userRepo.update(user);
    await this.authClient.removeRoleFromUser(uid, role);
  }
}
