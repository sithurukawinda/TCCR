import { OutboxEventPublisher } from '@shared/events';
import { IProgressRepository }  from '../../domain/repositories/IProgressRepository';

export class ResetProgressUseCase {
  constructor(
    private readonly progressRepo: IProgressRepository,
    private readonly outbox:       OutboxEventPublisher,
  ) {}

  async execute(studentUid: string, courseId: string, requestId: string): Promise<void> {
    await this.progressRepo.deleteByStudentAndCourse(studentUid, courseId);
    await this.outbox.publishWithBatch({
      type:      'audit.action',
      payload:   { action: 'progress.reset', studentUid, courseId },
      requestId,
    });
  }
}
