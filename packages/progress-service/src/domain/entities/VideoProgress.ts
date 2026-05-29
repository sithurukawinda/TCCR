export interface VideoProgressProps {
  id:             string;  // "{studentUid}_{lessonId}"
  studentUid:     string;
  lessonId:       string;
  courseId:       string;
  watchedSeconds: number;
  updatedAt:      string;
}

export class VideoProgress {
  id:             string;
  studentUid:     string;
  lessonId:       string;
  courseId:       string;
  watchedSeconds: number;
  updatedAt:      string;

  constructor(props: VideoProgressProps) {
    this.id             = props.id;
    this.studentUid     = props.studentUid;
    this.lessonId       = props.lessonId;
    this.courseId       = props.courseId;
    this.watchedSeconds = props.watchedSeconds;
    this.updatedAt      = props.updatedAt;
  }

  update(watchedSeconds: number): void {
    this.watchedSeconds = watchedSeconds;
    this.updatedAt      = new Date().toISOString();
  }
}
