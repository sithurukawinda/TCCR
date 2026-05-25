import { RoleRequest, RoleRequestStatus } from '../entities/RoleRequest';

export interface RoleRequestListOptions {
  limit:   number;
  cursor?: string;
  status?: RoleRequestStatus;
}

export interface RoleRequestListResult {
  items:      RoleRequest[];
  nextCursor: string | null;
  total:      number;
}

export interface IRoleRequestRepository {
  findById(id: string): Promise<RoleRequest | null>;
  findPendingByRequester(requesterUid: string): Promise<RoleRequest | null>;
  findByRequester(requesterUid: string): Promise<RoleRequest[]>;
  findAll(opts: RoleRequestListOptions): Promise<RoleRequestListResult>;
  create(req: RoleRequest): Promise<void>;
  update(req: RoleRequest): Promise<void>;
}
