import { ResetProgressUseCase }  from '../../../src/application/use-cases/ResetProgressUseCase';
import { IProgressRepository }  from '../../../src/domain/repositories/IProgressRepository';
import { OutboxEventPublisher } from '@shared/events';

const makeRepo = (): jest.Mocked<IProgressRepository> => ({
  findByStudentAndSubject: jest.fn(),
  findByCourseAndStudent:  jest.fn(),
  findByCourse:            jest.fn(),
  upsert:                  jest.fn(),
  deleteByStudentAndCourse: jest.fn(),
});

const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn() } as unknown as jest.Mocked<OutboxEventPublisher>);

describe('ResetProgressUseCase', () => {
  let repo:    jest.Mocked<IProgressRepository>;
  let outbox:  jest.Mocked<OutboxEventPublisher>;
  let useCase: ResetProgressUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    outbox  = makeOutbox();
    useCase = new ResetProgressUseCase(repo, outbox);
  });

  it('deletes all progress for student+course and publishes audit.action event', async () => {
    repo.deleteByStudentAndCourse.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    await useCase.execute('uid-1', 'course-1', 'req-1');

    expect(repo.deleteByStudentAndCourse).toHaveBeenCalledWith('uid-1', 'course-1');
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type:    'audit.action',
        payload: expect.objectContaining({ action: 'progress.reset', studentUid: 'uid-1', courseId: 'course-1' }),
      }),
    );
  });

  it('propagates errors from deleteByStudentAndCourse', async () => {
    repo.deleteByStudentAndCourse.mockRejectedValue(new Error('DB error'));
    await expect(useCase.execute('uid-1', 'course-1', 'req-1')).rejects.toThrow('DB error');
    expect(outbox.publishWithBatch).not.toHaveBeenCalled();
  });

  it('propagates errors from outbox publish', async () => {
    repo.deleteByStudentAndCourse.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockRejectedValue(new Error('Outbox error'));

    await expect(useCase.execute('uid-1', 'course-1', 'req-1')).rejects.toThrow('Outbox error');
  });

  it('includes requestId in the published event', async () => {
    repo.deleteByStudentAndCourse.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    await useCase.execute('uid-1', 'course-1', 'req-abc');

    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'req-abc' }),
    );
  });
});
