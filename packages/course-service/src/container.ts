import { OutboxEventPublisher }                  from '@shared/events';
import { FirestoreCourseRepository }             from './infrastructure/repositories/FirestoreCourseRepository';
import { FirestoreSemesterRepository }           from './infrastructure/repositories/FirestoreSemesterRepository';
import { FirestoreSubjectRepository }            from './infrastructure/repositories/FirestoreSubjectRepository';
import { FirestoreLessonRepository }             from './infrastructure/repositories/FirestoreLessonRepository';
import { FirestoreBatchRepository }              from './infrastructure/repositories/FirestoreBatchRepository';
import { FirestoreBatchSemesterRepository }      from './infrastructure/repositories/FirestoreBatchSemesterRepository';
import { CreateCourseUseCase }                   from './application/use-cases/CreateCourseUseCase';
import { UpdateCourseUseCase }                   from './application/use-cases/UpdateCourseUseCase';
import { GetCourseUseCase }                      from './application/use-cases/GetCourseUseCase';
import { PublishCourseUseCase }                  from './application/use-cases/PublishCourseUseCase';
import { UnpublishCourseUseCase }                from './application/use-cases/UnpublishCourseUseCase';
import { ArchiveCourseUseCase }                  from './application/use-cases/ArchiveCourseUseCase';
import { RestoreCourseUseCase }                  from './application/use-cases/RestoreCourseUseCase';
import { DeleteCourseUseCase }                   from './application/use-cases/DeleteCourseUseCase';
import { HardDeleteCourseUseCase }              from './application/use-cases/HardDeleteCourseUseCase';
import { CreateSemesterUseCase }                 from './application/use-cases/CreateSemesterUseCase';
import { UpdateSemesterUseCase }                 from './application/use-cases/UpdateSemesterUseCase';
import { DeleteSemesterUseCase }                 from './application/use-cases/DeleteSemesterUseCase';
import { CreateSubjectUseCase }                  from './application/use-cases/CreateSubjectUseCase';
import { UpdateSubjectUseCase }                  from './application/use-cases/UpdateSubjectUseCase';
import { DeleteSubjectUseCase }                  from './application/use-cases/DeleteSubjectUseCase';
import { GetSubjectCountUseCase }                from './application/use-cases/GetSubjectCountUseCase';
import { CreateLessonUseCase }                   from './application/use-cases/CreateLessonUseCase';
import { UpdateLessonUseCase }                   from './application/use-cases/UpdateLessonUseCase';
import { DeleteLessonUseCase }                   from './application/use-cases/DeleteLessonUseCase';
import { CreateBatchUseCase }                    from './application/use-cases/CreateBatchUseCase';
import { GetBatchesUseCase }                     from './application/use-cases/GetBatchesUseCase';
import { GetBatchUseCase }                       from './application/use-cases/GetBatchUseCase';
import { UpdateBatchUseCase }                    from './application/use-cases/UpdateBatchUseCase';
import { OpenBatchUseCase }                      from './application/use-cases/OpenBatchUseCase';
import { CloseBatchUseCase }                     from './application/use-cases/CloseBatchUseCase';
import { SetBatchSemesterDatesUseCase }          from './application/use-cases/SetBatchSemesterDatesUseCase';
import { PatchBatchSemesterDateUseCase }         from './application/use-cases/PatchBatchSemesterDateUseCase';
import { GetStudentCourseUseCase }               from './application/use-cases/GetStudentCourseUseCase';
import { CourseController }                      from './http/controllers/CourseController';
import { SemesterController }                    from './http/controllers/SemesterController';
import { SubjectController }                     from './http/controllers/SubjectController';
import { LessonController }                      from './http/controllers/LessonController';
import { InternalCourseController }              from './http/controllers/InternalCourseController';
import { BatchController }                       from './http/controllers/BatchController';
import { StudentCourseController }               from './http/controllers/StudentCourseController';

// Repos
const courseRepo     = new FirestoreCourseRepository();
const semesterRepo   = new FirestoreSemesterRepository();
const subjectRepo    = new FirestoreSubjectRepository();
const lessonRepo     = new FirestoreLessonRepository();
const batchRepo      = new FirestoreBatchRepository();
const bsRepo         = new FirestoreBatchSemesterRepository();
const outbox         = new OutboxEventPublisher();

// Course use cases
const createCourse    = new CreateCourseUseCase(courseRepo);
const updateCourse    = new UpdateCourseUseCase(courseRepo);
const getCourse       = new GetCourseUseCase(courseRepo, semesterRepo, subjectRepo, batchRepo, bsRepo);
const publishCourse   = new PublishCourseUseCase(courseRepo, semesterRepo, outbox);
const unpublishCourse = new UnpublishCourseUseCase(courseRepo);
const archiveCourse   = new ArchiveCourseUseCase(courseRepo);
const restoreCourse   = new RestoreCourseUseCase(courseRepo);
const deleteCourse    = new DeleteCourseUseCase(courseRepo);
const hardDeleteCourse = new HardDeleteCourseUseCase(courseRepo);

// Semester use cases
const createSemester = new CreateSemesterUseCase(courseRepo, semesterRepo, batchRepo, bsRepo);
const updateSemester = new UpdateSemesterUseCase(semesterRepo);
const deleteSemester = new DeleteSemesterUseCase(courseRepo, semesterRepo, subjectRepo, lessonRepo, bsRepo);

// Subject use cases
const createSubject = new CreateSubjectUseCase(semesterRepo, subjectRepo);
const updateSubject = new UpdateSubjectUseCase(subjectRepo);
const deleteSubject = new DeleteSubjectUseCase(semesterRepo, subjectRepo, lessonRepo);

const getSubjectCount = new GetSubjectCountUseCase(courseRepo, semesterRepo);

// Batch use cases
const createBatch       = new CreateBatchUseCase(courseRepo, batchRepo, semesterRepo, bsRepo);
const getBatches        = new GetBatchesUseCase(batchRepo);
const getBatch          = new GetBatchUseCase(batchRepo);
const updateBatch       = new UpdateBatchUseCase(batchRepo);
const openBatch         = new OpenBatchUseCase(batchRepo, bsRepo);
const closeBatch        = new CloseBatchUseCase(batchRepo);
const setBatchDates     = new SetBatchSemesterDatesUseCase(batchRepo, semesterRepo, bsRepo);
const patchBatchDate    = new PatchBatchSemesterDateUseCase(batchRepo, semesterRepo, bsRepo);
const getStudentCourse  = new GetStudentCourseUseCase(courseRepo, semesterRepo, subjectRepo, batchRepo, bsRepo);

// Lesson use cases
const createLesson = new CreateLessonUseCase(subjectRepo, lessonRepo);
const updateLesson = new UpdateLessonUseCase(lessonRepo);
const deleteLesson = new DeleteLessonUseCase(lessonRepo);

export const container = {
  courseController:         new CourseController(courseRepo, createCourse, updateCourse, getCourse, publishCourse, unpublishCourse, archiveCourse, restoreCourse, deleteCourse, hardDeleteCourse),
  semesterController:       new SemesterController(createSemester, updateSemester, deleteSemester, semesterRepo),
  subjectController:        new SubjectController(createSubject, updateSubject, deleteSubject, subjectRepo),
  lessonController:         new LessonController(lessonRepo, createLesson, updateLesson, deleteLesson),
  internalCourseController: new InternalCourseController(getSubjectCount, courseRepo, subjectRepo, lessonRepo),
  batchController:          new BatchController(createBatch, getBatches, getBatch, updateBatch, openBatch, closeBatch, setBatchDates, patchBatchDate),
  studentCourseController:  new StudentCourseController(getStudentCourse),
};
