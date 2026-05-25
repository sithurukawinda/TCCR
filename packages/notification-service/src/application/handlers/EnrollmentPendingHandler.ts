import { v4 as uuidv4 }              from 'uuid';
import { INotificationRepository }   from '../../domain/repositories/INotificationRepository';
import { Notification }              from '../../domain/entities/Notification';
import { UserServiceClient }         from '../../infrastructure/clients/UserServiceClient';

export interface EnrollmentPendingPayload {
  studentUid: string;
  courseId:   string;
}

export class EnrollmentPendingHandler {
  constructor(
    private readonly notifRepo:   INotificationRepository,
    private readonly userClient:  UserServiceClient,
  ) {}

  async handle(_payload: EnrollmentPendingPayload, _requestId: string): Promise<void> {
    const adminUids = await this.userClient.getAdminUids();
    const now       = new Date().toISOString();

    await Promise.all(adminUids.map(adminUid =>
      this.notifRepo.create(new Notification({
        id:        uuidv4(),
        userUid:   adminUid,
        type:      'enrollment.pending',
        title:     'New Enrollment Request',
        body:      'A student has requested enrollment in a course.',
        read:      false,
        createdAt: now,
      })),
    ));
  }
}
