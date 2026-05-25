import { createHttpError } from '@shared/errors';

export type BatchState = 'draft' | 'open' | 'closed';

export interface BatchProps {
  id:              string;
  courseId:        string;
  name:            string;
  scheduledOpenAt: string | null;
  intakeStart:     string;
  intakeEnd:       string;
  capacity:        number | null;
  state:           BatchState;
  createdAt:       string;
  updatedAt:       string;
}

export class Batch {
  id:              string;
  courseId:        string;
  name:            string;
  scheduledOpenAt: string | null;
  intakeStart:     string;
  intakeEnd:       string;
  capacity:        number | null;
  state:           BatchState;
  readonly createdAt: string;
  updatedAt:       string;

  constructor(props: BatchProps) {
    this.id              = props.id;
    this.courseId        = props.courseId;
    this.name            = props.name;
    this.scheduledOpenAt = props.scheduledOpenAt;
    this.intakeStart     = props.intakeStart;
    this.intakeEnd       = props.intakeEnd;
    this.capacity        = props.capacity;
    this.state           = props.state;
    this.createdAt       = props.createdAt;
    this.updatedAt       = props.updatedAt;
  }

  open(): void {
    if (this.state !== 'draft') {
      throw createHttpError(409, 'INVALID_STATE', 'Only a DRAFT batch can be opened.');
    }
    this.state     = 'open';
    this.updatedAt = new Date().toISOString();
  }

  close(): void {
    if (this.state !== 'open') {
      throw createHttpError(409, 'INVALID_STATE', 'Only an OPEN batch can be closed.');
    }
    this.state     = 'closed';
    this.updatedAt = new Date().toISOString();
  }

  isEnrollable(): boolean {
    if (this.state !== 'open') return false;
    const now   = new Date();
    const start = new Date(this.intakeStart);
    const end   = new Date(this.intakeEnd);
    return now >= start && now <= end;
  }

  update(fields: { name?: string; scheduledOpenAt?: string | null; intakeStart?: string; intakeEnd?: string; capacity?: number | null }): void {
    if (fields.name            !== undefined) this.name            = fields.name;
    if (fields.scheduledOpenAt !== undefined) this.scheduledOpenAt = fields.scheduledOpenAt;
    if (fields.intakeStart     !== undefined) this.intakeStart     = fields.intakeStart;
    if (fields.intakeEnd       !== undefined) this.intakeEnd       = fields.intakeEnd;
    if (fields.capacity        !== undefined) this.capacity        = fields.capacity;
    this.updatedAt = new Date().toISOString();
  }
}
