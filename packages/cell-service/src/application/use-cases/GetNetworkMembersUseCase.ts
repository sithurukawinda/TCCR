import { createHttpError }       from '@shared/errors';
import { Role }                  from '@shared/auth-middleware';
import { ICellGroupRepository }  from '../../domain/repositories/ICellGroupRepository';
import { UserServiceClient,
         MemberProfile }         from '../../infrastructure/clients/UserServiceClient';

export interface NetworkCellMembers {
  cellId:      string;
  cellName:    string;
  cellType:    string;
  area:        string;
  leaderUid:   string;
  memberCount: number;
  members:     MemberProfile[];
}

export interface NetworkMembersResult {
  items:        NetworkCellMembers[];
  totalCells:   number;
  totalMembers: number;
}

/**
 * Returns all members across every cell in the caller's G12 network,
 * grouped by cell so the G12 can see which members belong to each leader.
 *
 * Scope by role:
 *   G12         → members from ALL active cells (org-wide read access)
 *   Leader      → members from their own cell only (leaderUid === callerUid)
 *   Admin/SA    → members from ALL active cells (no UID filter)
 */
export class GetNetworkMembersUseCase {
  constructor(
    private readonly cellRepo:   ICellGroupRepository,
    private readonly userClient: UserServiceClient,
  ) {}

  async execute(
    callerUid:   string,
    callerRoles: Role[],
  ): Promise<NetworkMembersResult> {
    const isAdmin  = callerRoles.includes('admin') || callerRoles.includes('super_admin');
    const isG12    = callerRoles.includes('g12');
    const isLeader = callerRoles.includes('leader');

    if (!isAdmin && !isG12 && !isLeader) {
      throw createHttpError(
        403,
        'FORBIDDEN',
        'Only G12 leaders, cell leaders, admin, and super_admin can access network members.',
      );
    }

    // ── Determine which cells to query ───────────────────────────────────────
    let cellFilter: { g12LeaderUid?: string; leaderUid?: string } = {};

    if (isAdmin) {
      cellFilter = {}; // all cells
    } else if (isG12) {
      cellFilter = {}; // G12 — org-wide read access (all cells)
    } else {
      cellFilter = { leaderUid: callerUid }; // leader sees their own cell
    }

    // Fetch up to 100 active cells in this network
    const cellResult = await this.cellRepo.findAll({
      limit: 100,
      state: 'active',
      ...cellFilter,
    });

    if (cellResult.items.length === 0) {
      return { items: [], totalCells: 0, totalMembers: 0 };
    }

    // ── Collect all unique member UIDs across all cells ──────────────────────
    const allUids = [...new Set(cellResult.items.flatMap(cell => cell.members))];

    // ── Single batch fetch — one call to user-service regardless of cell count
    const profiles   = await this.userClient.getMemberProfiles(allUids);
    const profileMap = new Map(profiles.map(p => [p.uid, p]));

    // ── Distribute profiles back to each cell ─────────────────────────────────
    const items: NetworkCellMembers[] = cellResult.items.map(cell => ({
      cellId:      cell.id,
      cellName:    cell.name,
      cellType:    cell.type,
      area:        cell.area,
      leaderUid:   cell.leaderUid,
      memberCount: cell.memberCount,
      members:     cell.members
        .map(uid => profileMap.get(uid))
        .filter((p): p is MemberProfile => p !== undefined),
    }));

    const totalMembers = items.reduce((sum, c) => sum + c.members.length, 0);

    return {
      items,
      totalCells:   cellResult.items.length,
      totalMembers,
    };
  }
}
