import { createHttpError }    from '@shared/errors';
import { OutboxEventPublisher } from '@shared/events';
import { IUserRepository }    from '../../domain/repositories/IUserRepository';
import { FirebaseAuthClient } from '../../infrastructure/clients/FirebaseAuthClient';
import { UserRole }           from '../../domain/entities/User';

/** Roles a G12/admin caller is permitted to grant. */
const PROMOTABLE_ROLES: UserRole[] = ['leader', 'g12'];

/** Roles a plain Leader (not g12/admin) caller is permitted to grant. */
const LEADER_PROMOTABLE_ROLES: UserRole[] = ['g12'];

export interface PromoteMemberInput {
  targetUid:   string;
  role:        'leader' | 'g12';
  callerUid:   string;
  callerRoles: UserRole[];
  requestId:   string;
}

export class PromoteMemberUseCase {
  constructor(
    private readonly userRepo:   IUserRepository,
    private readonly authClient: FirebaseAuthClient,
    private readonly outbox:     OutboxEventPublisher,
  ) {}

  async execute(input: PromoteMemberInput): Promise<void> {
    const { targetUid, role, callerUid, callerRoles, requestId } = input;

    // Determine what the caller is allowed to grant based on their roles
    const isElevatedCaller =
      callerRoles.includes('g12') ||
      callerRoles.includes('admin') ||
      callerRoles.includes('super_admin');

    const allowedRoles = isElevatedCaller ? PROMOTABLE_ROLES : LEADER_PROMOTABLE_ROLES;

    if (!allowedRoles.includes(role)) {
      throw createHttpError(
        403,
        'FORBIDDEN',
        isElevatedCaller
          ? `Callers may only promote members to 'leader' or 'g12'.`
          : `Leaders may only promote members to 'g12'.`,
      );
    }

    const target = await this.userRepo.findById(targetUid);
    if (!target) throw createHttpError(404, 'USER_NOT_FOUND', 'User not found.');

    // Prevent promoting admins or super_admins
    if (
      target.roles.includes('admin') ||
      target.roles.includes('super_admin')
    ) {
      throw createHttpError(
        403,
        'FORBIDDEN',
        'Cannot promote an admin account.',
      );
    }

    // Idempotent — already has the role
    if (target.roles.includes(role)) return;

    target.addRole(role);
    await this.userRepo.update(target);
    await this.authClient.addRoleToUser(targetUid, role);

    await this.outbox.publishWithBatch({
      type:    'audit.action',
      payload: {
        actorUid:   callerUid,
        actorEmail: '',
        action:     `PROMOTE_TO_${role.toUpperCase()}`,
        category:   'user',
        targetType: 'user',
        targetId:   targetUid,
      },
      requestId,
    });
  }
}
