import { ICellGroupRepository, CellGroupListOptions } from '../../domain/repositories/ICellGroupRepository';
import { CellType, CellState }                        from '../../domain/entities/CellGroup';
import { UserServiceClient, MemberProfile }            from '../../infrastructure/clients/UserServiceClient';
import { Role }                                        from '@shared/auth-middleware';

export interface CellGroupListItem {
  id:           string;
  name:         string;
  type:         CellType;
  area:         string;
  leaderUid:    string;
  g12LeaderUid: string;
  members:      MemberProfile[];
  memberCount:  number;
  reportCount:  number;
  state:        CellState;
  createdAt:    string;
  updatedAt:    string;
}

export interface CellGroupListResultEnriched {
  items:      CellGroupListItem[];
  nextCursor: string | null;
  total:      number;
}

export class GetCellsUseCase {
  constructor(
    private readonly cellRepo:   ICellGroupRepository,
    private readonly userClient: UserServiceClient,
  ) {}

  async execute(opts: CellGroupListOptions, callerUid: string, callerRoles: Role[]): Promise<CellGroupListResultEnriched> {
    const isAdmin  = callerRoles.includes('admin') || callerRoles.includes('super_admin');
    const isG12    = callerRoles.includes('g12');
    const isLeader = callerRoles.includes('leader');

    let result;

    // admin / super_admin — see ALL cell groups across ALL states by default.
    // State filter is applied only when explicitly provided via ?state=...
    if (isAdmin) {
      result = await this.cellRepo.findAll({ ...opts });
    } else if (isG12) {
      // G12 — see all cells (active by default, can pass ?state=archived)
      result = await this.cellRepo.findAll({ ...opts, state: opts.state ?? 'active' });
    } else if (isLeader) {
      // Leader — see only their own cells
      result = await this.cellRepo.findAll({ ...opts, leaderUid: callerUid, state: opts.state ?? 'active' });
    } else {
      // Members / students — see all active cells (to find one to join)
      result = await this.cellRepo.findAll({ ...opts, state: 'active' });
    }

    // Deduplicate all member UIDs across every cell in one pass,
    // then fetch all profiles in a single parallel call to user-service.
    const allUids    = [...new Set(result.items.flatMap(c => c.members))];
    const profiles   = await this.userClient.getMemberProfiles(allUids);
    const profileMap = new Map(profiles.map(p => [p.uid, p]));

    const enrichedItems: CellGroupListItem[] = result.items.map(cell => ({
      id:           cell.id,
      name:         cell.name,
      type:         cell.type,
      area:         cell.area,
      leaderUid:    cell.leaderUid,
      g12LeaderUid: cell.g12LeaderUid,
      members:      cell.members.map(uid =>
        profileMap.get(uid) ?? { uid, firstName: '', lastName: '', displayName: '' },
      ),
      memberCount:  cell.memberCount,
      reportCount:  cell.reportCount,
      state:        cell.state,
      createdAt:    cell.createdAt,
      updatedAt:    cell.updatedAt,
    }));

    return { items: enrichedItems, nextCursor: result.nextCursor, total: result.total };
  }
}
