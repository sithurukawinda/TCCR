import { ICellGroupRepository } from '../../domain/repositories/ICellGroupRepository';
import { CellGroup }             from '../../domain/entities/CellGroup';

export class GetMyCellsUseCase {
  constructor(private readonly cellRepo: ICellGroupRepository) {}

  async execute(uid: string): Promise<CellGroup[]> {
    return this.cellRepo.findByMember(uid);
  }
}
