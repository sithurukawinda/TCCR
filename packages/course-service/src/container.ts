import { OutboxEventPublisher }           from '@shared/events';
import { FirestoreCourseRepository }      from './infrastructure/repositories/FirestoreCourseRepository';
import { FirestoreSemesterRepository }    from './infrastructure/repositories/FirestoreSemesterRepository';
import { FirestoreSubjectRepository }     from './infrastructure/repositories/FirestoreSubjectRepository';
import { FirestoreLessonRepository }      from './infrastructure/repositories/FirestoreLessonRepository';
import { CreateCourseUseCase }            from './application/use-cases/CreateCourseUseCase';
import { UpdateCourseUseCase }            from './application/use-cases/UpdateCourseUseCase';
import { GetCourseUseCase }               from './application/use-cases/GetCourseUseCase';
import { PublishCourseUseCase }           from './application/use-cases/PublishCourseUseCase';
import { UnpublishCourseUseCase }         from './application/use-cases/UnpublishCourseUseCase';
import { ArchiveCourseUseCase }           from './application/use-cases/ArchiveCourseUseCase';
import { RestoreCourseUseCase }           from './application/use-cases/RestoreCourseUseCase';
import { DeleteCourseUseCase }            from './application/use-cases/DeleteCourseUseCase';
import { CreateSemesterUseCase }          from './application/use-cases/CreateSemesterUseCase';
import { UpdateSemesterUseCase }          from './application/use-cases/UpdateSemesterUseCase';
import { DeleteSemesterUseCase }          from './application/use-cases/DeleteSemesterUseCase';
import { CreateSubjectUseCase }           from './application/use-cases/CreateSubjectUseCase';
import { UpdateSubjectUseCase }           from './application/use-cases/UpdateSubjectUseCase';
import { DeleteSubjectUseCase }           from './application/use-cases/DeleteSubjectUseCase';
import { GetSubjectCountUseCase }         from './application/use-cases/GetSubjectCountUseCase';
import { CreateLessonUseCase }            from './application/use-cases/CreateLessonUseCase';
import { UpdateLessonUseCase }            from './application/use-cases/UpdateLessonUseCase';
import { DeleteLessonUseCase }            from './application/use-cases/DeleteLessonUseCase';
import { CourseController }               from './http/controllers/CourseController';
import { SemesterController }             from './http/controllers/SemesterController';
import { SubjectController }              from './http/controllers/SubjectController';
import { LessonController }               from './http/controllers/LessonController';
import { InternalCourseController }       from './http/controllers/InternalCourseController';
import { FirestoreBatchRepository }        from './infrastructure/repositories/FirestoreBatchRepository';
import { CreateBatchUseCase }               from './application/use-cases/CreateBatchUseCase';
import { GetBatchesUseCase }                from './application/use-cases/GetBatchesUseCase';
import { GetBatchUseCase }                  from './application/use-cases/GetBatchUseCase';
import { UpdateBatchUseCase }               from './application/use-cases/UpdateBatchUseCase';
import { OpenBatchUseCase }                 from './application/use-cases/OpenBatchUseCase';
import { CloseBatchUseCase }                from './application/use-cases/CloseBatchUseCase';
import { BatchController }                  from './http/controllers/BatchController';


// Repos
const courseRepo   = new FirestoreCourseRepository();
const semesterRepo = new FirestoreSemesterRepository();
const subjectRepo  = new FirestoreSubjectRepository();
const lessonRepo   = new FirestoreLessonRepository();
const outbox       = new OutboxEventPublisher();

// Use cases
const createCourse    = new CreateCourseUseCase(courseRepo);
const updateCourse    = new UpdateCourseUseCase(courseRepo);
const getCourse       = new GetCourseUseCase(courseRepo, semesterRepo, subjectRepo);
const publishCourse   = new PublishCourseUseCase(courseRepo, semesterRepo, outbox);
const unpublishCourse = new UnpublishCourseUseCase(courseRepo);
const archiveCourse   = new ArchiveCourseUseCase(courseRepo);
const restoreCourse   = new RestoreCourseUseCase(courseRepo);
const deleteCourse    = new DeleteCourseUseCase(courseRepo);

const createSemester = new CreateSemesterUseCase(courseRepo, semesterRepo);
const updateSemester = new UpdateSemesterUseCase(semesterRepo);
const deleteSemester = new DeleteSemesterUseCase(courseRepo, semesterRepo);

const createSubject = new CreateSubjectUseCase(semesterRepo, subjectRepo);
const updateSubject = new UpdateSubjectUseCase(subjectRepo);
const deleteSubject = new DeleteSubjectUseCase(semesterRepo, subjectRepo);

const getSubjectCount = new GetSubjectCountUseCase(courseRepo, semesterRepo);
const batchRepo    = new FirestoreBatchRepository();
const createBatch  = new CreateBatchUseCase(courseRepo, batchRepo);
const getBatches   = new GetBatchesUseCase(batchRepo);
const getBatch     = new GetBatchUseCase(batchRepo);
const updateBatch  = new UpdateBatchUseCase(batchRepo);
const openBatch    = new OpenBatchUseCase(batchRepo);
const closeBatch   = new CloseBatchUseCase(batchRepo);


const createLesson = new CreateLessonUseCase(subjectRepo, lessonRepo);
const updateLesson = new UpdateLessonUseCase(lessonRepo);
const deleteLesson = new DeleteLessonUseCase(lessonRepo);

export const container = {
  courseController:         new CourseController(courseRepo, createCourse, updateCourse, getCourse, publishCourse, unpublishCourse, archiveCourse, restoreCourse, deleteCourse),
  semesterController:       new SemesterController(createSemester, updateSemester, deleteSemester, semesterRepo),
  subjectController:        new SubjectController(createSubject, updateSubject, deleteSubject, subjectRepo),
  lessonController:         new LessonController(lessonRepo, createLesson, updateLesson, deleteLesson),
  internalCourseController: new InternalCourseController(getSubjectCount, courseRepo, subjectRepo),
  batchController:          new BatchController(createBatch, getBatches, getBatch, updateBatch, openBatch, closeBatch),
};
