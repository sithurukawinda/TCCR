import { createHttpError }     from '@shared/errors';
import { ISemesterRepository } from '../../domain/repositories/ISemesterRepository';
import { ISubjectRepository }  from '../../domain/repositories/ISubjectRepository';
import { ILessonRepository }   from '../../domain/repositories/ILessonRepository';

export class DeleteSubjectUseCase {
  constructor(
    private readonly semesterRepo: ISemesterRepository,
    private readonly subjectRepo:  ISubjectRepository,
    private readonly lessonRepo:   ILessonRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const subject = await this.subjectRepo.findById(id);
    if (!subject) throw createHttpError(404, 'SUBJECT_NOT_FOUND', 'Subject not found.');

    // Cascade: permanently delete all lessons in this subject first
    await this.lessonRepo.deleteBySubjectId(id);

    // Hard delete the subject itself
    await this.subjectRepo.hardDelete(id);

    // Decrement parent semester's subject count
    const semester = await this.semesterRepo.findById(subject.semesterId);
    if (semester && semester.subjectCount > 0) {
      semester.subjectCount -= 1;
      semester.updatedAt = new Date().toISOString();
      await this.semesterRepo.update(semester);
    }
  }
}
