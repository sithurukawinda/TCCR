import { v4 as uuidv4 }              from 'uuid';
import { INotificationRepository }   from '../../domain/repositories/INotificationRepository';
import { Notification }              from '../../domain/entities/Notification';
import { NotificationDispatcher }    from '../services/NotificationDispatcher';

export interface RegistrationApprovedPayload {
  studentUid: string;
  email:      string;
}

export class RegistrationApprovedHandler {
  constructor(
    private readonly notifRepo:   INotificationRepository,
    private readonly dispatcher:  NotificationDispatcher,
  ) {}

  async handle(payload: RegistrationApprovedPayload, requestId: string): Promise<void> {
    await this.notifRepo.create(new Notification({
      id:        uuidv4(),
      userUid:   payload.studentUid,
      type:      'registration.approved',
      title:     'Registration Approved',
      body:      'Your registration has been approved. You can now enroll in courses.',
      read:      false,
      createdAt: new Date().toISOString(),
    }));

    await this.dispatcher.dispatchEmail(
      payload.email,
      'Registration Approved — CMP',
      '<p>Your CMP registration has been approved. You can now log in and enroll in courses.</p>',
      requestId,
    );
  }
}
