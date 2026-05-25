import { createHttpError }         from '@shared/errors';
import { OutboxEventPublisher }    from '@shared/events';
import { IRegistrationRepository } from '../../domain/repositories/IRegistrationRepository';
import { Registration }            from '../../domain/entities/Registration';

export class RejectRegistrationUseCase {
  constructor(
    private readonly regRepo: IRegistrationRepository,
    private readonly outbox:  OutboxEventPublisher,
  ) {}

  async execute(id: string, reason: string | undefined, requestId: string): Promise<Registration> {
    const reg = await this.regRepo.findById(id);
    if (!reg) throw createHttpError(404, 'ENROLLMENT_NOT_FOUND', 'Registration not found.');

    reg.reject(reason);
    await this.regRepo.update(reg);

    await this.outbox.publishWithBatch({
      type:      'registration.rejected',
      payload:   { studentUid: reg.studentUid, email: reg.email, reason: reason ?? null },
      requestId,
    });

    return reg;
  }
}
