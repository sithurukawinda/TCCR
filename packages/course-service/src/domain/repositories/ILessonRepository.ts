import { Lesson } from '../entities/Lesson';

export interface ILessonRepository {
  findById(id: string): Promise<Lesson | null>;
  findBySubject(subjectId: string): Promise<Lesson[]>;
  create(lesson: Lesson): Promise<void>;
  update(lesson: Lesson): Promise<void>;
  softDelete(id: string): Promise<void>;
  hardDelete(id: string): Promise<void>;
  deleteBySubjectId(subjectId: string): Promise<void>;
  nextOrder(subjectId: string): Promise<number>;
  countBySubject(subjectId: string): Promise<number>;
  countByCourse(courseId: string): Promise<number>;
}
