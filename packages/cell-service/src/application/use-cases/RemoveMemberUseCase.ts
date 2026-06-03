import { createHttpError }       from '@shared/errors';
import { ICellGroupRepository }  from '../../domain/repositories/ICellGroupRepository';
import { Role }                  from '@shared/auth-middleware';

export interface RemoveMemberResult {
  removed:     string;
  memberCount: number;
}

export class RemoveMemberUseCase {
  constructor(private readonly cellRepo: ICellGroupRepository) {}

  async execute(cellId: string, memberUid: string, callerUid: string, callerRoles: Role[]): Promise<RemoveMemberResult> {
    const cell = await this.cellRepo.findById(cellId);
    if (!cell) throw createHttpError(404, 'CELL_NOT_FOUND', 'Cell group not found.');

    const isAdmin = callerRoles.includes('admin') || callerRoles.includes('super_admin');
    if (!isAdmin && !cell.isOwnedBy(callerUid)) {
      throw createHttpError(403, 'FORBIDDEN', 'Only the cell owner or an admin can remove members.');
    }

    const inRegistered = cell.members.includes(memberUid);
    const inExternal   = cell.externalMembers.some(e => e.id === memberUid);

    if (!inRegistered && !inExternal) {
      throw createHttpError(404, 'MEMBER_NOT_FOUND', 'User is not a member of this cell.');
    }

    if (inRegistered) {
      cell.removeMember(memberUid);
    } else {
      cell.removeExternalMember(memberUid);
    }

    await this.cellRepo.update(cell);
    return { removed: memberUid, memberCount: cell.memberCount };
  }
}
