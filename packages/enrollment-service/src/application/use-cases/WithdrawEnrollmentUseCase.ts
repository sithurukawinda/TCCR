import { createHttpError }        from '@shared/errors';
import { OutboxEventPublisher }  from '@shared/events';
import { IEnrollmentRepository } from '../../domain/repositories/IEnrollmentRepository';
import { Enrollment }            from '../../domain/entities/Enrollment';

export class WithdrawEnrollmentUseCase {
  constructor(
    private readonly enrollRepo: IEnrollmentRepository,
    private readonly outbox:     OutboxEventPublisher,
  ) {}

  async execute(id: string, studentUid: string, requestId: string): Promise<Enrollment> {
    const enrollment = await this.enrollRepo.findById(id);
    if (!enrollment) throw createHttpError(404, 'ENROLLMENT_NOT_FOUND', 'Enrollment not found.');
    if (enrollment.studentUid !== studentUid) throw createHttpError(403, 'FORBIDDEN', 'You do not own this enrollment.');

    enrollment.withdraw();
    await this.enrollRepo.update(enrollment);
    await this.outbox.publishWithBatch({ type: 'enrollment.withdrawn', payload: { studentUid, courseId: enrollment.courseId }, requestId });

    return enrollment;
  }
}
