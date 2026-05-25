import { createHttpError }      from '@shared/errors';
import { IProgressRepository }  from '../../domain/repositories/IProgressRepository';
import { SubjectProgress }      from '../../domain/entities/SubjectProgress';

export class GetSubjectProgressUseCase {
  constructor(private readonly progressRepo: IProgressRepository) {}

  async execute(studentUid: string, subjectId: string): Promise<SubjectProgress> {
    const progress = await this.progressRepo.findByStudentAndSubject(studentUid, subjectId);
    if (!progress) throw createHttpError(404, 'SUBJECT_NOT_FOUND', 'No progress record found for this subject.');
    return progress;
  }
}
