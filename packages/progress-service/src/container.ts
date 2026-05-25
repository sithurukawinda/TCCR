import { OutboxEventPublisher }         from '@shared/events';
import { FirestoreProgressRepository }  from './infrastructure/repositories/FirestoreProgressRepository';
import { CourseServiceClient }          from './infrastructure/clients/CourseServiceClient';
import { MarkSubjectCompleteUseCase }   from './application/use-cases/MarkSubjectCompleteUseCase';
import { UpdateLastAccessedUseCase }    from './application/use-cases/UpdateLastAccessedUseCase';
import { ComputeCourseProgressUseCase } from './application/use-cases/ComputeCourseProgressUseCase';
import { ResetProgressUseCase }         from './application/use-cases/ResetProgressUseCase';
import { GetSubjectProgressUseCase }    from './application/use-cases/GetSubjectProgressUseCase';
import { ProgressController }           from './http/controllers/ProgressController';
import { InternalProgressController }   from './http/controllers/InternalProgressController';

const progressRepo  = new FirestoreProgressRepository();
const courseClient  = new CourseServiceClient();
const outbox        = new OutboxEventPublisher();

const markComplete   = new MarkSubjectCompleteUseCase(progressRepo, outbox);
const updateAccessed = new UpdateLastAccessedUseCase(progressRepo);
const computeProg    = new ComputeCourseProgressUseCase(progressRepo, courseClient);
const resetProg      = new ResetProgressUseCase(progressRepo, outbox);
const getSubjectProg = new GetSubjectProgressUseCase(progressRepo);

export const container = {
  progressController:         new ProgressController(markComplete, updateAccessed, computeProg, getSubjectProg, progressRepo),
  internalProgressController: new InternalProgressController(resetProg),
};
