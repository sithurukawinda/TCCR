export interface SubjectProps {
  id:         string;
  semesterId: string;
  courseId:   string;
  title:      string;
  order:      number;
  deletedAt:  string | null;
  createdAt:  string;
  updatedAt:  string;
}

export class Subject {
  id:         string;
  semesterId: string;
  courseId:   string;
  title:      string;
  order:      number;
  deletedAt:  string | null;
  readonly createdAt: string;
  updatedAt:  string;

  constructor(props: SubjectProps) {
    this.id         = props.id;
    this.semesterId = props.semesterId;
    this.courseId   = props.courseId;
    this.title      = props.title;
    this.order      = props.order;
    this.deletedAt  = props.deletedAt;
    this.createdAt  = props.createdAt;
    this.updatedAt  = props.updatedAt;
  }

  update(fields: { title?: string }): void {
    if (fields.title !== undefined) this.title = fields.title;
    this.updatedAt = new Date().toISOString();
  }

  softDelete(): void {
    this.deletedAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }
}
