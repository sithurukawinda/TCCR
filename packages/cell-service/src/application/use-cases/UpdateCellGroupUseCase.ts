import { createHttpError }       from '@shared/errors';
import { ICellGroupRepository }  from '../../domain/repositories/ICellGroupRepository';
import { CellGroup, CellType }   from '../../domain/entities/CellGroup';
import { Role }                  from '@shared/auth-middleware';

export interface UpdateCellInput {
  name?:         string;
  type?:         CellType;
  area?:         string;
  g12LeaderUid?: string;
}

export class UpdateCellGroupUseCase {
  constructor(private readonly cellRepo: ICellGroupRepository) {}

  async execute(id: string, input: UpdateCellInput, callerUid: string, callerRoles: Role[]): Promise<CellGroup> {
    const cell = await this.cellRepo.findById(id);
    if (!cell) throw createHttpError(404, 'CELL_NOT_FOUND', 'Cell group not found.');

    const isAdmin = callerRoles.includes('admin') || callerRoles.includes('super_admin');
    if (!isAdmin && !cell.isOwnedBy(callerUid)) {
      throw createHttpError(403, 'FORBIDDEN', 'Only the cell owner or an admin can update this cell.');
    }

    cell.update(input);
    await this.cellRepo.update(cell);
    return cell;
  }
}
