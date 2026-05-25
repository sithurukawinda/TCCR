import { Notification } from '../entities/Notification';

export interface NotificationListOptions {
  limit:   number;
  cursor?: string;
  read?:   boolean;
}

export interface NotificationListResult {
  items:      Notification[];
  nextCursor: string | null;
  total:      number;
}

export interface INotificationRepository {
  findByUser(userUid: string, opts: NotificationListOptions): Promise<NotificationListResult>;
  create(notification: Notification): Promise<void>;
  markRead(id: string, userUid: string): Promise<void>;
  markAllRead(userUid: string): Promise<void>;
}
