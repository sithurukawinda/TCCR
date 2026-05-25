import { createHttpError } from '@shared/errors';

export type CellType  = 'g12' | 'care' | 'children' | 'outreach';
export type CellState = 'active' | 'archived';

export interface CellGroupProps {
  id:           string;
  name:         string;
  type:         CellType;
  area:         string;
  leaderUid:    string;
  g12LeaderUid: string;
  members:      string[];
  memberCount:  number;
  reportCount:  number;
  state:        CellState;
  createdAt:    string;
  updatedAt:    string;
}

export class CellGroup {
  id:           string;
  name:         string;
  type:         CellType;
  area:         string;
  leaderUid:    string;
  g12LeaderUid: string;
  members:      string[];
  memberCount:  number;
  reportCount:  number;
  state:        CellState;
  readonly createdAt: string;
  updatedAt:    string;

  constructor(props: CellGroupProps) {
    this.id           = props.id;
    this.name         = props.name;
    this.type         = props.type;
    this.area         = props.area;
    this.leaderUid    = props.leaderUid;
    this.g12LeaderUid = props.g12LeaderUid;
    this.members      = props.members;
    this.memberCount  = props.memberCount;
    this.reportCount  = props.reportCount;
    this.state        = props.state;
    this.createdAt    = props.createdAt;
    this.updatedAt    = props.updatedAt;
  }

  isOwnedBy(uid: string): boolean {
    return this.leaderUid === uid || this.g12LeaderUid === uid;
  }

  hasMember(uid: string): boolean {
    return this.members.includes(uid);
  }

  addMembers(uids: string[]): string[] {
    const added: string[] = [];
    for (const uid of uids) {
      if (!this.members.includes(uid)) {
        this.members.push(uid);
        added.push(uid);
      }
    }
    if (added.length > 0) {
      this.memberCount = this.members.length;
      this.updatedAt   = new Date().toISOString();
    }
    return added;
  }

  removeMember(uid: string): void {
    if (!this.members.includes(uid)) {
      throw createHttpError(404, 'MEMBER_NOT_FOUND', 'User is not a member of this cell.');
    }
    this.members     = this.members.filter(m => m !== uid);
    this.memberCount = this.members.length;
    this.updatedAt   = new Date().toISOString();
  }

  update(fields: { name?: string; type?: CellType; area?: string; g12LeaderUid?: string }): void {
    if (fields.name         !== undefined) this.name         = fields.name;
    if (fields.type         !== undefined) this.type         = fields.type;
    if (fields.area         !== undefined) this.area         = fields.area;
    if (fields.g12LeaderUid !== undefined) this.g12LeaderUid = fields.g12LeaderUid;
    this.updatedAt = new Date().toISOString();
  }

  archive(): void {
    if (this.state === 'archived') {
      throw createHttpError(409, 'INVALID_STATE', 'Cell group is already archived.');
    }
    this.state     = 'archived';
    this.updatedAt = new Date().toISOString();
  }

  incrementReportCount(): void {
    this.reportCount++;
    this.updatedAt = new Date().toISOString();
  }
}
