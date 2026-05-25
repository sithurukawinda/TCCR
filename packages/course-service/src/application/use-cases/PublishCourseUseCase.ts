import { createHttpError }       from '@shared/errors';
import { OutboxEventPublisher }  from '@shared/events';
import { ICourseRepository }     from '../../domain/repositories/ICourseRepository';
import { ISemesterRepository }   from '../../domain/repositories/ISemesterRepository';
import { Course }                from '../../domain/entities/Course';

export class PublishCourseUseCase {
  constructor(
    private readonly courseRepo:   ICourseRepository,
    private readonly semesterRepo: ISemesterRepository,
    private readonly outbox:       OutboxEventPublisher,
  ) {}

  async execute(id: string, requestId: string): Promise<Course> {
    const course = await this.courseRepo.findById(id);
    if (!course) throw createHttpError(404, 'COURSE_NOT_FOUND', 'Course not found.');

    const semesters = await this.semesterRepo.findByCourseId(id);
    if (semesters.length === 0) {
      throw createHttpError(422, 'NO_SEMESTERS', 'Course must have at least one semester before publishing.');
    }

    const empty = semesters.find(s => s.subjectCount === 0);
    if (empty) {
      throw createHttpError(422, 'EMPTY_SEMESTER', `Semester "${empty.title}" has no subjects.`);
    }

    course.publish(); // throws 409 if not DRAFT
    await this.courseRepo.update(course);

    await this.outbox.publishWithBatch({
      type:      'course.published',
      payload:   { courseId: id, title: course.title },
      requestId,
    });

    return course;
  }
}
