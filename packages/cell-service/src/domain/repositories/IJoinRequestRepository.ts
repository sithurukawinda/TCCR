import { JoinRequest, JoinRequestStatus } from '../entities/JoinRequest';

export interface JoinRequestListOptions {
  limit:    number;
  cursor?:  string;
  status?:  JoinRequestStatus;
}

export interface JoinRequestListResult {
  items:      JoinRequest[];
  nextCursor: string | null;
  total:      number;
}

export interface IJoinRequestRepository {
  findById(cellId: string, id: string): Promise<JoinRequest | null>;
  findPendingByRequester(cellId: string, requesterUid: string): Promise<JoinRequest | null>;
  findAll(cellId: string, opts: JoinRequestListOptions): Promise<JoinRequestListResult>;
  create(req: JoinRequest): Promise<void>;
  update(req: JoinRequest): Promise<void>;
}
