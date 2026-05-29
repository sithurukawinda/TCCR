import { v4 as uuidv4 }            from 'uuid';
import { OutboxEventPublisher }     from '@shared/events';
import { ICellGroupRepository }     from '../../domain/repositories/ICellGroupRepository';
import { CellGroup, CellType }      from '../../domain/entities/CellGroup';

export interface CreateCellGroupInput {
  name:         string;
  type:         CellType;
  area:         string;
  leaderUid:    string;
  g12LeaderUid: string;
}

export class CreateCellGroupUseCase {
  constructor(
    private readonly cellRepo: ICellGroupRepository,
    private readonly outbox:   OutboxEventPublisher,
  ) {}

  async execute(input: CreateCellGroupInput, requestId: string): Promise<CellGroup> {
    const now  = new Date().toISOString();
    const cell = new CellGroup({
      id:           uuidv4(),
      name:         input.name,
      type:         input.type,
      area:         input.area,
      leaderUid:    input.leaderUid,
      g12LeaderUid: input.g12LeaderUid,
      members:         [input.leaderUid],
      externalMembers: [],
      memberCount:     1,
      reportCount:  0,
      state:        'active',
      createdAt:    now,
      updatedAt:    now,
    });

    await this.cellRepo.create(cell);

    await this.outbox.publishWithBatch({
      type:      'cell.created',
      payload:   { cellId: cell.id, name: cell.name, leaderUid: cell.leaderUid },
      requestId,
    });

    return cell;
  }
}
