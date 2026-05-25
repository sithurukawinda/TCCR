export interface LessonProps {
  id:             string;
  subjectId:      string;
  courseId:       string;
  semesterId:     string;
  title:          string;
  description:    string;
  youtubeVideoId: string | null;
  attachmentIds:  string[];
  order:          number;
  deletedAt:      string | null;
  createdAt:      string;
  updatedAt:      string;
}

export class Lesson {
  id:             string;
  subjectId:      string;
  courseId:       string;
  semesterId:     string;
  title:          string;
  description:    string;
  youtubeVideoId: string | null;
  attachmentIds:  string[];
  order:          number;
  deletedAt:      string | null;
  readonly createdAt: string;
  updatedAt:      string;

  constructor(props: LessonProps) {
    this.id             = props.id;
    this.subjectId      = props.subjectId;
    this.courseId       = props.courseId;
    this.semesterId     = props.semesterId;
    this.title          = props.title;
    this.description    = props.description;
    this.youtubeVideoId = props.youtubeVideoId;
    this.attachmentIds  = props.attachmentIds;
    this.order          = props.order;
    this.deletedAt      = props.deletedAt;
    this.createdAt      = props.createdAt;
    this.updatedAt      = props.updatedAt;
  }

  update(fields: { title?: string; description?: string; youtubeVideoId?: string | null; attachmentIds?: string[] }): void {
    if (fields.title          !== undefined) this.title          = fields.title;
    if (fields.description    !== undefined) this.description    = fields.description;
    if (fields.youtubeVideoId !== undefined) this.youtubeVideoId = fields.youtubeVideoId;
    if (fields.attachmentIds  !== undefined) this.attachmentIds  = fields.attachmentIds;
    this.updatedAt = new Date().toISOString();
  }

  softDelete(): void {
    this.deletedAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }
}
