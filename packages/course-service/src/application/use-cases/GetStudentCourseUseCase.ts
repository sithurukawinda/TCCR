import { createHttpError }           from '@shared/errors';
import { ICourseRepository }          from '../../domain/repositories/ICourseRepository';
import { ISemesterRepository }        from '../../domain/repositories/ISemesterRepository';
import { ISubjectRepository }         from '../../domain/repositories/ISubjectRepository';
import { IBatchRepository }           from '../../domain/repositories/IBatchRepository';
import { IBatchSemesterRepository }   from '../../domain/repositories/IBatchSemesterRepository';
import { Semester }                   from '../../domain/entities/Semester';
import { Subject }                    from '../../domain/entities/Subject';

type SemesterState = 'unscheduled' | 'upcoming' | 'open' | 'closed';

function deriveSemesterState(openDate: string | null, endDate: string | null): SemesterState {
  if (openDate === null || endDate === null) return 'unscheduled';
  const today = new Date().toISOString().slice(0, 10);
  if (today < openDate) return 'upcoming';
  if (today > endDate)  return 'closed';
  return 'open';
}

export interface StudentCourseView {
  id:    string;
  title: string;
  state: string;
  batch: {
    id:          string;
    name:        string;
    intakeStart: string;
    intakeEnd:   string;
  };
  semesters: Array<{
    id:           string;
    title:        string;
    order:        number;
    subjectCount: number;
    openDate:     string | null;
    endDate:      string | null;
    state:        SemesterState;
    subjects: Array<{
      id:        string;
      title:     string;
      order:     number;
      createdAt: string;
      updatedAt: string;
    }>;
  }>;
}

export class GetStudentCourseUseCase {
  constructor(
    private readonly courseRepo:   ICourseRepository,
    private readonly semesterRepo: ISemesterRepository,
    private readonly subjectRepo:  ISubjectRepository,
    private readonly batchRepo:    IBatchRepository,
    private readonly bsRepo:       IBatchSemesterRepository,
  ) {}

  async execute(courseId: string, batchId: string): Promise<StudentCourseView> {
    const course = await this.courseRepo.findById(courseId);
    if (!course || course.deletedAt !== null || course.state !== 'published') {
      throw createHttpError(404, 'COURSE_NOT_FOUND', 'Course not found.');
    }

    const batch = await this.batchRepo.findById(batchId);
    if (!batch || batch.courseId !== courseId) {
      throw createHttpError(404, 'BATCH_NOT_FOUND', 'Batch not found for this course.');
    }

    const bsRows  = await this.bsRepo.findByBatchId(batchId);
    const dateMap = new Map(bsRows.map(r => [r.semesterId, { openDate: r.openDate, endDate: r.endDate }]));

    const semesters = await this.semesterRepo.findByCourseId(courseId);
    const activeSemesters = semesters
      .filter((s: Semester) => s.deletedAt === null)
      .sort((a: Semester, b: Semester) => a.order - b.order);

    const semesterViews = await Promise.all(
      activeSemesters.map(async (sem: Semester) => {
        const subjects = await this.subjectRepo.findBySemesterId(sem.id);
        const active   = subjects
          .filter((s: Subject) => s.deletedAt === null)
          .sort((a: Subject, b: Subject) => a.order - b.order);

        const dates = dateMap.get(sem.id) ?? { openDate: null, endDate: null };

        return {
          id:           sem.id,
          title:        sem.title,
          order:        sem.order,
          subjectCount: sem.subjectCount,
          openDate:     dates.openDate,
          endDate:      dates.endDate,
          state:        deriveSemesterState(dates.openDate, dates.endDate),
          subjects:     active.map((s: Subject) => ({
            id:        s.id,
            title:     s.title,
            order:     s.order,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
          })),
        };
      }),
    );

    return {
      id:    course.id,
      title: course.title,
      state: course.state,
      batch: {
        id:          batch.id,
        name:        batch.name,
        intakeStart: batch.intakeStart,
        intakeEnd:   batch.intakeEnd,
      },
      semesters: semesterViews,
    };
  }
}
