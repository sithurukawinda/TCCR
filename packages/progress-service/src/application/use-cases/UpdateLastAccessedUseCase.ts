import { IProgressRepository }  from '../../domain/repositories/IProgressRepository';
import { SubjectProgress }      from '../../domain/entities/SubjectProgress';

export interface UpdateLastAccessedInput {
  studentUid: string;
  subjectId:  string;
  courseId:   string;
  semesterId: string;
  lessonId?:  string;
}

export class UpdateLastAccessedUseCase {
  constructor(private readonly progressRepo: IProgressRepository) {}

  async execute(input: UpdateLastAccessedInput): Promise<SubjectProgress> {
    let progress = await this.progressRepo.findByStudentAndSubject(input.studentUid, input.subjectId);

    if (!progress) {
      progress = SubjectProgress.createNew(input.studentUid, input.subjectId, input.courseId, input.semesterId);
    }

    progress.updateLastAccessed(input.lessonId);
    await this.progressRepo.upsert(progress);
    return progress;
  }
}
