import { createHttpError }         from '@shared/errors';
import { OutboxEventPublisher }    from '@shared/events';
import { IRegistrationRepository } from '../../domain/repositories/IRegistrationRepository';
import { UserServiceClient }       from '../../infrastructure/clients/UserServiceClient';
import { Registration }            from '../../domain/entities/Registration';

export class ApproveRegistrationUseCase {
  constructor(
    private readonly regRepo:     IRegistrationRepository,
    private readonly userClient:  UserServiceClient,
    private readonly outbox:      OutboxEventPublisher,
  ) {}

  async execute(id: string, requestId: string): Promise<Registration> {
    const reg = await this.regRepo.findById(id);
    if (!reg) throw createHttpError(404, 'ENROLLMENT_NOT_FOUND', 'Registration not found.');

    reg.approve();

    try {
      await this.userClient.approveUser(reg.studentUid);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 404) {
        throw createHttpError(422, 'USER_NOT_FOUND', 'The student account no longer exists and cannot be approved.');
      }
      throw err;
    }

    await this.regRepo.update(reg);

    await this.outbox.publishWithBatch({
      type:      'registration.approved',
      payload:   { studentUid: reg.studentUid, email: reg.email },
      requestId,
    });

    return reg;
  }
}
