import { Subject } from '../entities/Subject';

export interface ISubjectRepository {
  findById(id: string): Promise<Subject | null>;
  findBySemesterId(semesterId: string): Promise<Subject[]>;
  findByCourseId(courseId: string): Promise<Subject[]>;
  create(subject: Subject): Promise<void>;
  update(subject: Subject): Promise<void>;
  softDelete(id: string): Promise<void>;
  hardDelete(id: string): Promise<void>;
  deleteBySemesterId(semesterId: string): Promise<void>;
}
