import { Enrollment, EnrollmentState } from '../entities/Enrollment';

export interface EnrollmentListOptions {
  limit:     number;
  cursor?:   string;
  state?:    EnrollmentState;
  courseId?: string;
}

export interface EnrollmentListResult {
  items:      Enrollment[];
  nextCursor: string | null;
  total:      number;
}

export interface IEnrollmentRepository {
  findById(id: string): Promise<Enrollment | null>;
  findByStudentAndCourse(studentUid: string, courseId: string): Promise<Enrollment | null>;
  findByStudent(studentUid: string, opts: EnrollmentListOptions): Promise<EnrollmentListResult>;
  findAll(opts: EnrollmentListOptions): Promise<EnrollmentListResult>;
  create(enrollment: Enrollment): Promise<void>;
  update(enrollment: Enrollment): Promise<void>;
}
