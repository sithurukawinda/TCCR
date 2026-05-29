import { VideoProgress } from '../entities/VideoProgress';

export interface IVideoProgressRepository {
  findByStudentAndLesson(studentUid: string, lessonId: string): Promise<VideoProgress | null>;
  save(progress: VideoProgress): Promise<void>;
}
