import { OutboxEventPublisher }                from '@shared/events';
import { FirestoreProgressRepository }         from './infrastructure/repositories/FirestoreProgressRepository';
import { FirestoreLessonProgressRepository }   from './infrastructure/repositories/FirestoreLessonProgressRepository';
import { FirestoreVideoProgressRepository }    from './infrastructure/repositories/FirestoreVideoProgressRepository';
import { CourseServiceClient }                 from './infrastructure/clients/CourseServiceClient';
import { EnrollmentServiceClient }             from './infrastructure/clients/EnrollmentServiceClient';
import { MarkSubjectCompleteUseCase }          from './application/use-cases/MarkSubjectCompleteUseCase';
import { UpdateLastAccessedUseCase }           from './application/use-cases/UpdateLastAccessedUseCase';
import { ComputeCourseProgressUseCase }        from './application/use-cases/ComputeCourseProgressUseCase';
import { ResetProgressUseCase }                from './application/use-cases/ResetProgressUseCase';
import { GetSubjectProgressUseCase }           from './application/use-cases/GetSubjectProgressUseCase';
import { MarkLessonCompleteUseCase }           from './application/use-cases/MarkLessonCompleteUseCase';
import { UnmarkLessonCompleteUseCase }         from './application/use-cases/UnmarkLessonCompleteUseCase';
import { SaveVideoPositionUseCase }            from './application/use-cases/SaveVideoPositionUseCase';
import { GetVideoPositionUseCase }             from './application/use-cases/GetVideoPositionUseCase';
import { ProgressController }                 from './http/controllers/ProgressController';
import { InternalProgressController }         from './http/controllers/InternalProgressController';

// Repositories
const progressRepo       = new FirestoreProgressRepository();
const lessonProgressRepo = new FirestoreLessonProgressRepository();
const videoProgressRepo  = new FirestoreVideoProgressRepository();

// Clients
const courseClient      = new CourseServiceClient();
const enrollmentClient  = new EnrollmentServiceClient();
const outbox            = new OutboxEventPublisher();

// Subject-level use cases
const markSubjectComplete = new MarkSubjectCompleteUseCase(progressRepo, outbox);
const updateAccessed      = new UpdateLastAccessedUseCase(progressRepo);
const computeProgress     = new ComputeCourseProgressUseCase(progressRepo, lessonProgressRepo, courseClient);
const resetProgress       = new ResetProgressUseCase(progressRepo, outbox);
const getSubjectProgress  = new GetSubjectProgressUseCase(progressRepo);

// Lesson-level use cases
const markLessonComplete = new MarkLessonCompleteUseCase(
  lessonProgressRepo,
  courseClient,
  enrollmentClient,
  markSubjectComplete,
);
const unmarkLesson = new UnmarkLessonCompleteUseCase(lessonProgressRepo, progressRepo, courseClient);

// Video position use cases
const saveVideoPosition = new SaveVideoPositionUseCase(videoProgressRepo);
const getVideoPosition  = new GetVideoPositionUseCase(videoProgressRepo);

export const container = {
  progressController: new ProgressController(
    markSubjectComplete,
    updateAccessed,
    computeProgress,
    getSubjectProgress,
    markLessonComplete,
    unmarkLesson,
    progressRepo,
    saveVideoPosition,
    getVideoPosition,
  ),
  internalProgressController: new InternalProgressController(resetProgress),
};
