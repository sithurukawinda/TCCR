import { createHttpError }       from '@shared/errors';
import { ICellGroupRepository }  from '../../domain/repositories/ICellGroupRepository';
import { CellType, CellState }   from '../../domain/entities/CellGroup';
import { Role }                  from '@shared/auth-middleware';
import { UserServiceClient, MemberProfile } from '../../infrastructure/clients/UserServiceClient';

// ── Discriminated union for mixed registered + external members ─────────────

export interface RegisteredMember extends MemberProfile {
  type: 'registered';
}

export interface ExternalMemberResponse {
  type:        'external';
  id:          string;
  name:        string;
  phone?:      string;
  displayName: string;
  uid:         null;
}

export type CellMember = RegisteredMember | ExternalMemberResponse;

/** Response shape for GET /cells/:id */
export interface CellGroupDetail {
  id:           string;
  name:         string;
  type:         CellType;
  area:         string;
  leaderUid:    string;
  g12LeaderUid: string;
  members:      CellMember[];
  memberCount:  number;
  reportCount:  number;
  state:        CellState;
  createdAt:    string;
  updatedAt:    string;
}

export class GetCellByIdUseCase {
  constructor(
    private readonly cellRepo:   ICellGroupRepository,
    private readonly userClient: UserServiceClient,
  ) {}

  async execute(id: string, callerUid: string, callerRoles: Role[]): Promise<CellGroupDetail> {
    const cell = await this.cellRepo.findById(id);
    if (!cell) throw createHttpError(404, 'CELL_NOT_FOUND', 'Cell group not found.');

    const isAdmin  = callerRoles.includes('admin') || callerRoles.includes('super_admin');
    const isOwner  = cell.isOwnedBy(callerUid);
    const isMember = cell.hasMember(callerUid);

    if (!isAdmin && !isOwner && !isMember) {
      throw createHttpError(403, 'FORBIDDEN', 'You do not have access to this cell group.');
    }

    // Enrich registered UIDs with names from user-service (failures are non-fatal).
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
      id:           cell.id,
      name:         cell.name,
      type:         cell.type,
      area:         cell.area,
      leaderUid:    cell.leaderUid,
      g12LeaderUid: cell.g12LeaderUid,
      members:      [...registered, ...external],
      memberCount:  cell.memberCount,
      reportCount:  cell.reportCount,
      state:        cell.state,
      createdAt:    cell.createdAt,
      updatedAt:    cell.updatedAt,
    };
  }
}
