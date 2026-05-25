import { createHttpError } from '@shared/errors';

export type RegistrationState = 'pending' | 'approved' | 'rejected';

export interface RegistrationProps {
  id:         string; // studentUid
  studentUid: string;
  email:      string;
  firstName:  string;
  lastName:   string;
  state:      RegistrationState;
  reason:     string | null;
  createdAt:  string;
  updatedAt:  string;
}

export class Registration {
  id:         string;
  studentUid: string;
  email:      string;
  firstName:  string;
  lastName:   string;
  state:      RegistrationState;
  reason:     string | null;
  readonly createdAt: string;
  updatedAt:  string;

  constructor(props: RegistrationProps) {
    this.id         = props.id;
    this.studentUid = props.studentUid;
    this.email      = props.email;
    this.firstName  = props.firstName;
    this.lastName   = props.lastName;
    this.state      = props.state;
    this.reason     = props.reason;
    this.createdAt  = props.createdAt;
    this.updatedAt  = props.updatedAt;
  }

  approve(): void {
    if (this.state !== 'pending') throw createHttpError(409, 'INVALID_STATE', 'Registration is not in PENDING state.');
    this.state     = 'approved';
    this.updatedAt = new Date().toISOString();
  }

  reject(reason?: string): void {
    if (this.state !== 'pending') throw createHttpError(409, 'INVALID_STATE', 'Registration is not in PENDING state.');
    this.state     = 'rejected';
    this.reason    = reason ?? null;
    this.updatedAt = new Date().toISOString();
  }
}
