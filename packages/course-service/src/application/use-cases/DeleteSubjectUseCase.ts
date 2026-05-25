import { createHttpError }     from '@shared/errors';
import { ISemesterRepository } from '../../domain/repositories/ISemesterRepository';
import { ISubjectRepository }  from '../../domain/repositories/ISubjectRepository';

export class DeleteSubjectUseCase {
  constructor(
    private readonly semesterRepo: ISemesterRepository,
    private readonly subjectRepo:  ISubjectRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const subject = await this.subjectRepo.findById(id);
    if (!subject) throw createHttpError(404, 'SUBJECT_NOT_FOUND', 'Subject not found.');

    await this.subjectRepo.softDelete(id);

    const semester = await this.semesterRepo.findById(subject.semesterId);
    if (semester && semester.subjectCount > 0) {
      semester.subjectCount -= 1;
      semester.updatedAt = new Date().toISOString();
      await this.semesterRepo.update(semester);
    }
  }
}
