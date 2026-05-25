import { createHttpError }    from '@shared/errors';
import { ISubjectRepository } from '../../domain/repositories/ISubjectRepository';
import { Subject }            from '../../domain/entities/Subject';

export interface UpdateSubjectInput {
  id:     string;
  title?: string;
}

export class UpdateSubjectUseCase {
  constructor(private readonly subjectRepo: ISubjectRepository) {}

  async execute(input: UpdateSubjectInput): Promise<Subject> {
    const subject = await this.subjectRepo.findById(input.id);
    if (!subject) throw createHttpError(404, 'SUBJECT_NOT_FOUND', 'Subject not found.');

    subject.update({ title: input.title });
    await this.subjectRepo.update(subject);
    return subject;
  }
}
