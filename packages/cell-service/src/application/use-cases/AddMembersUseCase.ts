import { createHttpError }       from '@shared/errors';
import { ICellGroupRepository }  from '../../domain/repositories/ICellGroupRepository';
import { Role }                  from '@shared/auth-middleware';

export interface AddMembersResult {
  added:       string[];
  memberCount: number;
}

export class AddMembersUseCase {
  constructor(private readonly cellRepo: ICellGroupRepository) {}

  async execute(cellId: string, userUids: string[], callerUid: string, callerRoles: Role[]): Promise<AddMembersResult> {
    const cell = await this.cellRepo.findById(cellId);
    if (!cell) throw createHttpError(404, 'CELL_NOT_FOUND', 'Cell group not found.');

    const isAdmin = callerRoles.includes('admin') || callerRoles.includes('super_admin');
    if (!isAdmin && !cell.isOwnedBy(callerUid)) {
      throw createHttpError(403, 'FORBIDDEN', 'Only the cell owner or an admin can add members.');
    }

    const added = cell.addMembers(userUids);
    if (added.length > 0) await this.cellRepo.update(cell);

    return { added, memberCount: cell.memberCount };
  }
}
