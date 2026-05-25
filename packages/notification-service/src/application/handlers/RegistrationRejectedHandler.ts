import { v4 as uuidv4 }              from 'uuid';
import { INotificationRepository }   from '../../domain/repositories/INotificationRepository';
import { Notification }              from '../../domain/entities/Notification';
import { NotificationDispatcher }    from '../services/NotificationDispatcher';

export interface RegistrationRejectedPayload {
  studentUid: string;
  email:      string;
  reason:     string | null;
}

export class RegistrationRejectedHandler {
  constructor(
    private readonly notifRepo:  INotificationRepository,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  async handle(payload: RegistrationRejectedPayload, requestId: string): Promise<void> {
    await this.notifRepo.create(new Notification({
      id:        uuidv4(),
      userUid:   payload.studentUid,
      type:      'registration.rejected',
      title:     'Registration Not Approved',
      body:      payload.reason ? `Your registration was not approved: ${payload.reason}` : 'Your registration was not approved.',
      read:      false,
      createdAt: new Date().toISOString(),
    }));

    await this.dispatcher.dispatchEmail(
      payload.email,
      'Registration Update — CMP',
      `<p>Your CMP registration was not approved.${payload.reason ? ` Reason: ${payload.reason}` : ''}</p>`,
      requestId,
    );
  }
}
