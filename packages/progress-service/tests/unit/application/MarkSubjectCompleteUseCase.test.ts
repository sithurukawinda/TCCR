import { MarkSubjectCompleteUseCase } from '../../../src/application/use-cases/MarkSubjectCompleteUseCase';
import { IProgressRepository }        from '../../../src/domain/repositories/IProgressRepository';
import { OutboxEventPublisher }       from '@shared/events';
import { SubjectProgress }            from '../../../src/domain/entities/SubjectProgress';

const makeProgress = (state: 'not_started' | 'in_progress' | 'completed', completedAt: string | null = null): SubjectProgress =>
  new SubjectProgress({ id: 'uid1_sub1', studentUid: 'uid1', subjectId: 'sub1', courseId: 'c1', semesterId: 'sem1', state, completedAt, lastAccessedAt: null });

const makeRepo   = (): jest.Mocked<IProgressRepository> =>
  ({ findByStudentAndSubject: jest.fn(), findByCourseAndStudent: jest.fn(), findByCourse: jest.fn(), upsert: jest.fn(), deleteByStudentAndCourse: jest.fn() });
const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn() } as unknown as jest.Mocked<OutboxEventPublisher>);

const INPUT = { studentUid: 'uid1', subjectId: 'sub1', courseId: 'c1', semesterId: 'sem1' };

describe('MarkSubjectCompleteUseCase', () => {
  let repo:    jest.Mocked<IProgressRepository>;
  let outbox:  jest.Mocked<OutboxEventPublisher>;
  let useCase: MarkSubjectCompleteUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    outbox  = makeOutbox();
    useCase = new MarkSubjectCompleteUseCase(repo, outbox);
  });

  it('marks a new subject as complete and sets completedAt', async () => {
    repo.findByStudentAndSubject.mockResolvedValue(null);
    repo.upsert.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute(INPUT, 'req-1');
    expect(result.state).toBe('completed');
    expect(result.completedAt).not.toBeNull();
    expect(repo.upsert).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — returns existing record unchanged without writing', async () => {
    const existing = makeProgress('completed', '2026-05-01T00:00:00.000Z');
    repo.findByStudentAndSubject.mockResolvedValue(existing);

    const result = await useCase.execute(INPUT, 'req-1');
    expect(result.completedAt).toBe('2026-05-01T00:00:00.000Z');
    expect(repo.upsert).not.toHaveBeenCalled();
    expect(outbox.publishWithBatch).not.toHaveBeenCalled();
  });

  it('updates an in_progress subject to completed', async () => {
    repo.findByStudentAndSubject.mockResolvedValue(makeProgress('in_progress'));
    repo.upsert.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute(INPUT, 'req-1');
    expect(result.state).toBe('completed');
  });
});
