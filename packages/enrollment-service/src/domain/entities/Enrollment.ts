import { createHttpError } from '@shared/errors';

export type EnrollmentState = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export interface EnrollmentProps {
  id:          string; // ${studentUid}_${courseId}
  studentUid:  string;
  courseId:    string;
  state:       EnrollmentState;
  reason:      string | null;
  rejectedAt:  string | null;
  approvedAt:  string | null;
  withdrawnAt: string | null;
  createdAt:   string;
  updatedAt:   string;
}

export class Enrollment {
  id:          string;
  studentUid:  string;
  courseId:    string;
  state:       EnrollmentState;
  reason:      string | null;
  rejectedAt:  string | null;
  approvedAt:  string | null;
  withdrawnAt: string | null;
  readonly createdAt: string;
  updatedAt:   string;

  constructor(props: EnrollmentProps) {
    this.id          = props.id;
    this.studentUid  = props.studentUid;
    this.courseId    = props.courseId;
    this.state       = props.state;
    this.reason      = props.reason;
    this.rejectedAt  = props.rejectedAt;
    this.approvedAt  = props.approvedAt;
    this.withdrawnAt = props.withdrawnAt;
    this.createdAt   = props.createdAt;
    this.updatedAt   = props.updatedAt;
  }

  approve(): void {
    if (this.state !== 'pending') throw createHttpError(409, 'INVALID_STATE', 'Enrollment is not in PENDING state.');
    this.state      = 'approved';
    this.approvedAt = new Date().toISOString();
    this.updatedAt  = new Date().toISOString();
  }

  reject(reason?: string): void {
    if (this.state !== 'pending') throw createHttpError(409, 'INVALID_STATE', 'Enrollment is not in PENDING state.');
    this.state      = 'rejected';
    this.reason     = reason ?? null;
    this.rejectedAt = new Date().toISOString();
    this.updatedAt  = new Date().toISOString();
  }

  withdraw(): void {
    if (this.state !== 'pending' && this.state !== 'approved') {
      throw createHttpError(409, 'INVALID_STATE', 'Enrollment cannot be withdrawn in its current state.');
    }
    this.state       = 'withdrawn';
    this.withdrawnAt = new Date().toISOString();
    this.updatedAt   = new Date().toISOString();
  }
}
