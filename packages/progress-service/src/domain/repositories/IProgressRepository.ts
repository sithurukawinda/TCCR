import { SubjectProgress } from '../entities/SubjectProgress';

export interface IProgressRepository {
  findByStudentAndSubject(studentUid: string, subjectId: string): Promise<SubjectProgress | null>;
  findByCourseAndStudent(courseId: string, studentUid: string): Promise<SubjectProgress[]>;
  findByCourse(courseId: string): Promise<SubjectProgress[]>;
  upsert(progress: SubjectProgress): Promise<void>;
  deleteByStudentAndCourse(studentUid: string, courseId: string): Promise<void>;
  /** Revert a completed subject back to in_progress (used when a lesson is unmarked). */
  revertCompletion(studentUid: string, subjectId: string): Promise<void>;
}
