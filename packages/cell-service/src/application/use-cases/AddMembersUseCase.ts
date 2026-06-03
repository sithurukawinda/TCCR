import { createHttpError }                  from '@shared/errors';
import { ICellGroupRepository }             from '../../domain/repositories/ICellGroupRepository';
import { Role }                             from '@shared/auth-middleware';
import { ExternalMember }                   from '../../domain/entities/CellGroup';

export interface AddMembersResult {
  added:         string[];
  addedExternal: ExternalMember[];
  memberCount:   number;
}

export class AddMembersUseCase {
  constructor(private readonly cellRepo: ICellGroupRepository) {}

  async execute(
    cellId:         string,
    userUids:       string[],
    callerUid:      string,
    callerRoles:    Role[],
    externalInputs: Array<{ name: string; phone?: string }> = [],
  ): Promise<AddMembersResult> {
    const cell = await this.cellRepo.findById(cellId);
    if (!cell) throw createHttpError(404, 'CELL_NOT_FOUND', 'Cell group not found.');

    const isAdmin = callerRoles.includes('admin') || callerRoles.includes('super_admin');
    if (!isAdmin && !cell.isOwnedBy(callerUid)) {
      throw createHttpError(403, 'FORBIDDEN', 'Only the cell owner or an admin can add members.');
    }

    const added         = cell.addMembers(userUids);
    const addedExternal = externalInputs.map(e => cell.addExternalMember(e.name, e.phone));

    if (added.length > 0 || addedExternal.length > 0) {
      await this.cellRepo.update(cell);
    }

    return { added, addedExternal, memberCount: cell.memberCount };
  }
}
