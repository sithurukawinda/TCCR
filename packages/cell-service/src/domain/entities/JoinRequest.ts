import { createHttpError } from '@shared/errors';

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected';

export interface JoinRequestProps {
  id:            string;
  cellId:        string;
  requesterUid:  string;
  message:       string | null;
  status:        JoinRequestStatus;
  decidedByUid:  string | null;
  decisionNote:  string | null;
  createdAt:     string;
  decidedAt:     string | null;
}

export class JoinRequest {
  id:            string;
  cellId:        string;
  requesterUid:  string;
  message:       string | null;
  status:        JoinRequestStatus;
  decidedByUid:  string | null;
  decisionNote:  string | null;
  readonly createdAt: string;
  decidedAt:     string | null;

  constructor(props: JoinRequestProps) {
    this.id           = props.id;
    this.cellId       = props.cellId;
    this.requesterUid = props.requesterUid;
    this.message      = props.message;
    this.status       = props.status;
    this.decidedByUid = props.decidedByUid;
    this.decisionNote = props.decisionNote;
    this.createdAt    = props.createdAt;
    this.decidedAt    = props.decidedAt;
  }

  approve(decidedByUid: string, note?: string): void {
    if (this.status !== 'pending') {
      throw createHttpError(409, 'INVALID_STATE', 'Join request is no longer pending.');
    }
    this.status       = 'approved';
    this.decidedByUid = decidedByUid;
    this.decisionNote = note ?? null;
    this.decidedAt    = new Date().toISOString();
  }

  reject(decidedByUid: string, note?: string): void {
    if (this.status !== 'pending') {
      throw createHttpError(409, 'INVALID_STATE', 'Join request is no longer pending.');
    }
    this.status       = 'rejected';
    this.decidedByUid = decidedByUid;
    this.decisionNote = note ?? null;
    this.decidedAt    = new Date().toISOString();
  }
}
