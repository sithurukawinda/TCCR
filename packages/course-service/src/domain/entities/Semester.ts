export type SemesterStatus = 'active' | 'disabled';

export interface SemesterProps {
  id:           string;
  courseId:     string;
  title:        string;
  subjectCount: number;
  order:        number;
  openDate?:    string | null;
  endDate?:     string | null;
  status?:      SemesterStatus;
  deletedAt:    string | null;
  createdAt:    string;
  updatedAt:    string;
}

export class Semester {
  id:           string;
  courseId:     string;
  title:        string;
  subjectCount: number;
  order:        number;
  openDate?:    string | null;
  endDate?:     string | null;
  status?:      SemesterStatus;
  deletedAt:    string | null;
  readonly createdAt: string;
  updatedAt:    string;

  constructor(props: SemesterProps) {
    this.id           = props.id;
    this.courseId     = props.courseId;
    this.title        = props.title;
    this.subjectCount = props.subjectCount;
    this.order        = props.order;
    this.openDate     = props.openDate   ?? null;
    this.endDate      = props.endDate    ?? null;
    this.status       = props.status     ?? 'active';
    this.deletedAt    = props.deletedAt;
    this.createdAt    = props.createdAt;
    this.updatedAt    = props.updatedAt;
  }

  isAccessible(): boolean {
    if (this.status === 'disabled') return false;
    if (this.openDate && new Date() < new Date(this.openDate)) return false;
    return true;
  }

  disable(): void {
    this.status    = 'disabled';
    this.updatedAt = new Date().toISOString();
  }

  update(fields: { title?: string; openDate?: string | null; endDate?: string | null }): void {
    if (fields.title    !== undefined) this.title    = fields.title;
    if (fields.openDate !== undefined) this.openDate = fields.openDate;
    if (fields.endDate  !== undefined) this.endDate  = fields.endDate;
    this.updatedAt = new Date().toISOString();
  }

  softDelete(): void {
    this.deletedAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }
}
