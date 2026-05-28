export interface BatchSemesterProps {
  id:         string;  // "{batchId}_{semesterId}"
  batchId:    string;
  semesterId: string;
  courseId:   string;
  openDate:   string | null;  // YYYY-MM-DD
  endDate:    string | null;  // YYYY-MM-DD
  createdAt:  string;
  updatedAt:  string;
}

export class BatchSemester {
  id:         string;
  batchId:    string;
  semesterId: string;
  courseId:   string;
  openDate:   string | null;
  endDate:    string | null;
  readonly createdAt: string;
  updatedAt:  string;

  constructor(props: BatchSemesterProps) {
    this.id         = props.id;
    this.batchId    = props.batchId;
    this.semesterId = props.semesterId;
    this.courseId   = props.courseId;
    this.openDate   = props.openDate;
    this.endDate    = props.endDate;
    this.createdAt  = props.createdAt;
    this.updatedAt  = props.updatedAt;
  }

  isScheduled(): boolean {
    return this.openDate !== null && this.endDate !== null;
  }

  setDates(openDate: string | null, endDate: string | null): void {
    this.openDate  = openDate;
    this.endDate   = endDate;
    this.updatedAt = new Date().toISOString();
  }
}
