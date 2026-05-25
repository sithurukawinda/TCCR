export interface AttachmentProps {
  id:          string;
  subjectId:   string;
  courseId:    string;
  filename:    string;
  mimeType:    string;
  sizeBytes:   number;
  storagePath: string;
  createdAt:   string;
}

export class Attachment {
  id:          string;
  subjectId:   string;
  courseId:    string;
  filename:    string;
  mimeType:    string;
  sizeBytes:   number;
  storagePath: string;
  readonly createdAt: string;

  constructor(props: AttachmentProps) {
    this.id          = props.id;
    this.subjectId   = props.subjectId;
    this.courseId    = props.courseId;
    this.filename    = props.filename;
    this.mimeType    = props.mimeType;
    this.sizeBytes   = props.sizeBytes;
    this.storagePath = props.storagePath;
    this.createdAt   = props.createdAt;
  }
}
