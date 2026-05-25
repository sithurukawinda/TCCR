export interface NotificationProps {
  id:        string;
  userUid:   string;
  type:      string;
  title:     string;
  body:      string;
  read:      boolean;
  createdAt: string;
}

export class Notification {
  id:        string;
  userUid:   string;
  type:      string;
  title:     string;
  body:      string;
  read:      boolean;
  readonly createdAt: string;

  constructor(props: NotificationProps) {
    this.id        = props.id;
    this.userUid   = props.userUid;
    this.type      = props.type;
    this.title     = props.title;
    this.body      = props.body;
    this.read      = props.read;
    this.createdAt = props.createdAt;
  }
}
