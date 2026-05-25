import { Course, CourseState } from '../entities/Course';

export interface CourseFindAllOptions {
  limit:   number;
  cursor?: string;
  state?:  CourseState;
  title?:  string;
}

export interface CourseFindPublishedOptions {
  limit:   number;
  cursor?: string;
  title?:  string;
}

export interface CourseListResult {
  items:      Course[];
  nextCursor: string | null;
  total:      number;
}

export interface ICourseRepository {
  findById(id: string): Promise<Course | null>;
  findByTitle(title: string): Promise<Course | null>;
  findPublished(opts: CourseFindPublishedOptions): Promise<CourseListResult>;
  findAll(opts: CourseFindAllOptions): Promise<CourseListResult>;
  create(course: Course): Promise<void>;
  update(course: Course): Promise<void>;
  softDelete(id: string): Promise<void>;
}
