import { v4 as uuidv4 }              from 'uuid';
import { INotificationRepository }   from '../../domain/repositories/INotificationRepository';
import { Notification }              from '../../domain/entities/Notification';
import { NotificationDispatcher }    from '../services/NotificationDispatcher';

export interface AdminSuspendedPayload {
  uid:       string;
  email:     string;
  firstName: string;
  lastName:  string;
}

export class AdminSuspendedHandler {
  constructor(
    private readonly notifRepo:  INotificationRepository,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  async handle(payload: AdminSuspendedPayload, requestId: string): Promise<void> {
    await this.notifRepo.create(new Notification({
      id:        uuidv4(),
      userUid:   payload.uid,
      type:      'admin.suspended',
      title:     'Account Suspended',
      body:      'Your admin account has been suspended. Contact the Super Admin for details.',
      read:      false,
      createdAt: new Date().toISOString(),
    }));

    await this.dispatcher.dispatchEmail(
      payload.email,
      'Account Suspended — CMP',
      '<p>Your CMP admin account has been suspended. Please contact the Super Admin.</p>',
      requestId,
    );
  }
}
