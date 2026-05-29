import { Semester } from '../entities/Semester';

export interface ISemesterRepository {
  findById(id: string): Promise<Semester | null>;
  findByCourseId(courseId: string): Promise<Semester[]>;
  create(semester: Semester): Promise<void>;
  update(semester: Semester): Promise<void>;
  softDelete(id: string): Promise<void>;
  hardDelete(id: string): Promise<void>;
}
