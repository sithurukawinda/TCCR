export interface LessonProgressProps {
  id:          string; // ${studentUid}_${lessonId}
  studentUid:  string;
  lessonId:    string;
  subjectId:   string;
  courseId:    string;
  semesterId:  string;
  batchId:     string | null;
  completedAt: string;
  createdAt:   string;
  updatedAt:   string;
}

export class LessonProgress {
  id:          string;
  studentUid:  string;
  lessonId:    string;
  subjectId:   string;
  courseId:    string;
  semesterId:  string;
  batchId:     string | null;
  completedAt: string;
  createdAt:   string;
  updatedAt:   string;

  constructor(props: LessonProgressProps) {
    this.id          = props.id;
    this.studentUid  = props.studentUid;
    this.lessonId    = props.lessonId;
    this.subjectId   = props.subjectId;
    this.courseId    = props.courseId;
    this.semesterId  = props.semesterId;
    this.batchId     = props.batchId;
    this.completedAt = props.completedAt;
    this.createdAt   = props.createdAt;
    this.updatedAt   = props.updatedAt;
  }

  static createNew(
    studentUid: string,
    lessonId:   string,
    subjectId:  string,
    courseId:   string,
    semesterId: string,
    batchId:    string | null,
  ): LessonProgress {
    const now = new Date().toISOString();
    return new LessonProgress({
      id: `${studentUid}_${lessonId}`,
      studentUid,
      lessonId,
      subjectId,
      courseId,
      semesterId,
      batchId,
      completedAt: now,
      createdAt:   now,
      updatedAt:   now,
    });
  }
}
