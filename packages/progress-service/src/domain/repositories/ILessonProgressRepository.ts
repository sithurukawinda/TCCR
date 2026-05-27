import { LessonProgress } from '../entities/LessonProgress';

export interface ILessonProgressRepository {
  findByStudentAndLesson(studentUid: string, lessonId: string): Promise<LessonProgress | null>;
  findByCourseAndStudent(courseId: string, studentUid: string): Promise<LessonProgress[]>;
  findBySubjectAndStudent(subjectId: string, studentUid: string): Promise<LessonProgress[]>;
  save(progress: LessonProgress): Promise<void>;
  delete(studentUid: string, lessonId: string): Promise<void>;
}
