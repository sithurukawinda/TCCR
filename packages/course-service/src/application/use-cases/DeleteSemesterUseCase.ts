import { createHttpError }               from '@shared/errors';
import { ICourseRepository }             from '../../domain/repositories/ICourseRepository';
import { ISemesterRepository }           from '../../domain/repositories/ISemesterRepository';
import { ISubjectRepository }            from '../../domain/repositories/ISubjectRepository';
import { ILessonRepository }             from '../../domain/repositories/ILessonRepository';
import { IBatchSemesterRepository }      from '../../domain/repositories/IBatchSemesterRepository';

export class DeleteSemesterUseCase {
  constructor(
    private readonly courseRepo:   ICourseRepository,
    private readonly semesterRepo: ISemesterRepository,
    private readonly subjectRepo:  ISubjectRepository,
    private readonly lessonRepo:   ILessonRepository,
    private readonly bsRepo:       IBatchSemesterRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const semester = await this.semesterRepo.findById(id);
    if (!semester) throw createHttpError(404, 'SEMESTER_NOT_FOUND', 'Semester not found.');

    // Cascade: find all subjects in this semester, delete their lessons, then delete subjects
    const subjects = await this.subjectRepo.findBySemesterId(id);
    await Promise.all(subjects.map(s => this.lessonRepo.deleteBySubjectId(s.id)));
    await this.subjectRepo.deleteBySemesterId(id);

    // Cascade: remove all BatchSemester schedule rows for this semester
    await this.bsRepo.deleteBySemesterId(id);

    // Hard delete the semester itself
    await this.semesterRepo.hardDelete(id);

    // Decrement parent course's semester count
    const course = await this.courseRepo.findById(semester.courseId);
    if (course && course.semesterCount > 0) {
      course.semesterCount -= 1;
      course.updatedAt = new Date().toISOString();
      await this.courseRepo.update(course);
    }
  }
}
