import { createHttpError }     from '@shared/errors';
import { ISemesterRepository } from '../../domain/repositories/ISemesterRepository';
import { Semester }            from '../../domain/entities/Semester';

export interface UpdateSemesterInput {
  id:        string;
  title?:    string;
  openDate?: string | null;
  endDate?:  string | null;
}

export class UpdateSemesterUseCase {
  constructor(private readonly semesterRepo: ISemesterRepository) {}

  async execute(input: UpdateSemesterInput): Promise<Semester> {
    const semester = await this.semesterRepo.findById(input.id);
    if (!semester) throw createHttpError(404, 'SEMESTER_NOT_FOUND', 'Semester not found.');

    semester.update({ title: input.title, openDate: input.openDate, endDate: input.endDate });
    await this.semesterRepo.update(semester);
    return semester;
  }
}
