import { IVideoProgressRepository } from '../../domain/repositories/IVideoProgressRepository';

export interface GetVideoPositionResult {
  lessonId:       string;
  watchedSeconds: number;
}

export class GetVideoPositionUseCase {
  constructor(private readonly repo: IVideoProgressRepository) {}

  async execute(studentUid: string, lessonId: string): Promise<GetVideoPositionResult> {
    const record = await this.repo.findByStudentAndLesson(studentUid, lessonId);
    return {
      lessonId,
      watchedSeconds: record?.watchedSeconds ?? 0,
    };
  }
}
