import { v4 as uuidv4 }        from 'uuid';
import { createHttpError }      from '@shared/errors';
import { Lesson }               from '../../domain/entities/Lesson';
import { ILessonRepository }    from '../../domain/repositories/ILessonRepository';
import { ISubjectRepository }   from '../../domain/repositories/ISubjectRepository';

export interface CreateLessonInput {
  subjectId:      string;
  title:          string;
  description:    string;
  youtubeVideoId: string | null;
  attachmentIds:  string[];
}

export class CreateLessonUseCase {
  constructor(
    private readonly subjectRepo: ISubjectRepository,
    private readonly lessonRepo:  ILessonRepository,
  ) {}

  async execute(input: CreateLessonInput): Promise<Lesson> {
    const subject = await this.subjectRepo.findById(input.subjectId);
    if (!subject || subject.deletedAt) throw createHttpError(404, 'SUBJECT_NOT_FOUND', 'Subject not found.');

    const order  = await this.lessonRepo.nextOrder(input.subjectId);
    const lesson = new Lesson({
      id:             uuidv4(),
      subjectId:      subject.id,
      courseId:       subject.courseId,
      semesterId:     subject.semesterId,
      title:          input.title,
      description:    input.description,
      youtubeVideoId: input.youtubeVideoId,
      attachmentIds:  input.attachmentIds,
      order,
      deletedAt:      null,
      createdAt:      new Date().toISOString(),
      updatedAt:      new Date().toISOString(),
    });

    await this.lessonRepo.create(lesson);
    return lesson;
  }
}
