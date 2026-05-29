import { createHttpError }              from '@shared/errors';
import { ICourseRepository }            from '../../domain/repositories/ICourseRepository';
import { ISemesterRepository }          from '../../domain/repositories/ISemesterRepository';
import { ISubjectRepository }           from '../../domain/repositories/ISubjectRepository';
import { IBatchRepository }             from '../../domain/repositories/IBatchRepository';
import { IBatchSemesterRepository }     from '../../domain/repositories/IBatchSemesterRepository';
import { Semester }                     from '../../domain/entities/Semester';
import { Subject }                      from '../../domain/entities/Subject';
import { Batch, BatchState }            from '../../domain/entities/Batch';

export interface SubjectView {
  id:        string;
  title:     string;
  order:     number;
  createdAt: string;
  updatedAt: string;
}

export interface SemesterView {
  id:           string;
  title:        string;
  subjectCount: number;
  order:        number;
  createdAt:    string;
  updatedAt:    string;
  subjects:     SubjectView[];
}

export interface BatchSemesterSchedule {
  semesterId: string;
  openDate:   string | null;
  endDate:    string | null;
}

export interface BatchView {
  id:          string;
  name:        string;
  intakeStart: string;
  intakeEnd:   string;
  capacity:    number | null;
  state:       BatchState;
  semesters:   BatchSemesterSchedule[];
}

export interface CourseDetail {
  id:            string;
  title:         string;
  state:         string;
  createdBy:     string;
  semesterCount: number;
  publishedAt:   string | null;
  deletedAt:     string | null;
  createdAt:     string;
  updatedAt:     string;
  semesters:     SemesterView[];
  batches:       BatchView[];
}

export class GetCourseUseCase {
  constructor(
    private readonly courseRepo:   ICourseRepository,
    private readonly semesterRepo: ISemesterRepository,
    private readonly subjectRepo:  ISubjectRepository,
    private readonly batchRepo:    IBatchRepository,
    private readonly bsRepo:       IBatchSemesterRepository,
  ) {}

  async execute(id: string, isAdmin: boolean): Promise<CourseDetail> {
    const course = await this.courseRepo.findById(id);

    if (!course || course.deletedAt !== null) {
      throw createHttpError(404, 'COURSE_NOT_FOUND', 'Course not found.');
    }

    if (!isAdmin && course.state !== 'published') {
      throw createHttpError(404, 'COURSE_NOT_FOUND', 'Course not found.');
    }

    const semesters = await this.semesterRepo.findByCourseId(id);
    const activeSemesters = semesters
      .filter((s: Semester) => s.deletedAt === null)
      .sort((a: Semester, b: Semester) => a.order - b.order);

    const semesterViews: SemesterView[] = await Promise.all(
      activeSemesters.map(async (sem: Semester) => {
        const subjects = await this.subjectRepo.findBySemesterId(sem.id);
        const activeSubjects = subjects
          .filter((s: Subject) => s.deletedAt === null)
          .sort((a: Subject, b: Subject) => a.order - b.order);

        return {
          id:           sem.id,
          title:        sem.title,
          subjectCount: sem.subjectCount,
          order:        sem.order,
          createdAt:    sem.createdAt,
          updatedAt:    sem.updatedAt,
          subjects:     activeSubjects.map((sub: Subject) => ({
            id:        sub.id,
            title:     sub.title,
            order:     sub.order,
            createdAt: sub.createdAt,
            updatedAt: sub.updatedAt,
          })),
        };
      }),
    );

    const batches = await this.batchRepo.findByCourseId(id);
    const batchViews: BatchView[] = await Promise.all(
      batches.map(async (b: Batch) => {
        const bsRows = await this.bsRepo.findByBatchId(b.id);
        return {
          id:          b.id,
          name:        b.name,
          intakeStart: b.intakeStart,
          intakeEnd:   b.intakeEnd,
          capacity:    b.capacity,
          state:       b.state,
          semesters:   bsRows.map(r => ({
            semesterId: r.semesterId,
            openDate:   r.openDate,
            endDate:    r.endDate,
          })),
        };
      }),
    );

    return { ...course, semesters: semesterViews, batches: batchViews };
  }
}
