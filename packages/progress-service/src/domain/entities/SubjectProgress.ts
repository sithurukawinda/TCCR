export type ProgressState = 'not_started' | 'in_progress' | 'completed';

export interface SubjectProgressProps {
  id:                   string; // ${studentUid}_${subjectId}
  studentUid:           string;
  subjectId:            string;
  courseId:             string;
  semesterId:           string;
  state:                ProgressState;
  completedAt:          string | null;
  lastAccessedAt:       string | null;
  lastAccessedLessonId: string | null;
}

export class SubjectProgress {
  id:                   string;
  studentUid:           string;
  subjectId:            string;
  courseId:             string;
  semesterId:           string;
  state:                ProgressState;
  completedAt:          string | null;
  lastAccessedAt:       string | null;
  lastAccessedLessonId: string | null;

  constructor(props: SubjectProgressProps) {
    this.id                   = props.id;
    this.studentUid           = props.studentUid;
    this.subjectId            = props.subjectId;
    this.courseId             = props.courseId;
    this.semesterId           = props.semesterId;
    this.state                = props.state;
    this.completedAt          = props.completedAt;
    this.lastAccessedAt       = props.lastAccessedAt;
    this.lastAccessedLessonId = props.lastAccessedLessonId ?? null;
  }

  static createNew(studentUid: string, subjectId: string, courseId: string, semesterId: string): SubjectProgress {
    return new SubjectProgress({
      id:                   `${studentUid}_${subjectId}`,
      studentUid,
      subjectId,
      courseId,
      semesterId,
      state:                'not_started',
      completedAt:          null,
      lastAccessedAt:       null,
      lastAccessedLessonId: null,
    });
  }

  markComplete(): void {
    if (this.state === 'completed') return; // idempotent — completedAt is immutable
    this.state       = 'completed';
    this.completedAt = new Date().toISOString();
  }

  updateLastAccessed(lessonId?: string): void {
    this.lastAccessedAt = new Date().toISOString();
    if (lessonId) this.lastAccessedLessonId = lessonId;
    if (this.state === 'not_started') this.state = 'in_progress';
  }
}
