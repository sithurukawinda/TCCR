import { SubjectProgress } from '../entities/SubjectProgress';

export interface IProgressRepository {
  findByStudentAndSubject(studentUid: string, subjectId: string): Promise<SubjectProgress | null>;
  findByCourseAndStudent(courseId: string, studentUid: string): Promise<SubjectProgress[]>;
  findByCourse(courseId: string): Promise<SubjectProgress[]>;
  upsert(progress: SubjectProgress): Promise<void>;
  deleteByStudentAndCourse(studentUid: string, courseId: string): Promise<void>;
}
