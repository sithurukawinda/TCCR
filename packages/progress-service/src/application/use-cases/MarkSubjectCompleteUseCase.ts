import { OutboxEventPublisher }  from '@shared/events';
import { IProgressRepository }   from '../../domain/repositories/IProgressRepository';
import { SubjectProgress }       from '../../domain/entities/SubjectProgress';

export interface MarkCompleteInput {
  studentUid: string;
  subjectId:  string;
  courseId:   string;
  semesterId: string;
}

export class MarkSubjectCompleteUseCase {
  constructor(
    private readonly progressRepo: IProgressRepository,
    private readonly outbox:       OutboxEventPublisher,
  ) {}

  async execute(input: MarkCompleteInput, requestId: string): Promise<SubjectProgress> {
    let progress = await this.progressRepo.findByStudentAndSubject(input.studentUid, input.subjectId);

    if (progress?.state === 'completed') return progress; // idempotent — no write

    if (!progress) {
      progress = SubjectProgress.createNew(input.studentUid, input.subjectId, input.courseId, input.semesterId);
    }

    progress.markComplete();
    await this.progressRepo.upsert(progress);

    await this.outbox.publishWithBatch({
      type:      'progress.subjectCompleted',
      payload:   { studentUid: input.studentUid, subjectId: input.subjectId, courseId: input.courseId },
      requestId,
    });

    return progress;
  }
}
