import { createHttpError }                                     from '@shared/errors';
import { Role }                                                from '@shared/auth-middleware';
import { ICellGroupRepository }                                from '../../domain/repositories/ICellGroupRepository';
import { UserServiceClient }                                   from '../../infrastructure/clients/UserServiceClient';
import { CellMember, RegisteredMember, ExternalMemberResponse } from './GetCellByIdUseCase';

export interface NetworkCellMembers {
  cellId:      string;
  cellName:    string;
  cellType:    string;
  area:        string;
  leaderUid:   string;
  memberCount: number;
  members:     CellMember[];
}

export interface NetworkMembersResult {
  items:        NetworkCellMembers[];
  totalCells:   number;
  totalMembers: number;
}

/**
 * Returns all members across every cell in the caller's G12 network,
 * grouped by cell. Members include both registered (enriched via user-service)
 * and external (unregistered) members.
 *
 * Scope by role:
 *   G12         → members from ALL active cells (org-wide read access)
 *   Leader      → members from their own cell only
 *   Admin/SA    → members from ALL active cells
 */
export class GetNetworkMembersUseCase {
  constructor(
    private readonly cellRepo:   ICellGroupRepository,
    private readonly userClient: UserServiceClient,
  ) {}

  async execute(callerUid: string, callerRoles: Role[]): Promise<NetworkMembersResult> {
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

    let cellFilter: { g12LeaderUid?: string; leaderUid?: string } = {};
    if (!isAdmin && !isG12) {
      cellFilter = { leaderUid: callerUid };
    }

    const cellResult = await this.cellRepo.findAll({ limit: 100, state: 'active', ...cellFilter });

    if (cellResult.items.length === 0) {
      return { items: [], totalCells: 0, totalMembers: 0 };
    }

    const items = await Promise.all(
      cellResult.items.map(async cell => {
        const profiles = await this.userClient.getMemberProfiles(cell.members);
        const registered: RegisteredMember[] = profiles.map(p => ({ ...p, type: 'registered' as const }));
        const external: ExternalMemberResponse[] = cell.externalMembers.map(e => ({
          type:        'external' as const,
          id:          e.id,
          name:        e.name,
          phone:       e.phone,
          displayName: e.name,
          uid:         null,
        }));
        return {
          cellId:      cell.id,
          cellName:    cell.name,
          cellType:    cell.type,
          area:        cell.area,
          leaderUid:   cell.leaderUid,
          memberCount: cell.memberCount,
          members:     [...registered, ...external],
        } satisfies NetworkCellMembers;
      }),
    );

    const totalMembers = items.reduce((sum, c) => sum + c.members.length, 0);

    return { items, totalCells: cellResult.items.length, totalMembers };
  }
}
