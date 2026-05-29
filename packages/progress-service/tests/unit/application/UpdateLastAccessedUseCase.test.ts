import { UpdateLastAccessedUseCase } from '../../../src/application/use-cases/UpdateLastAccessedUseCase';
import { IProgressRepository }       from '../../../src/domain/repositories/IProgressRepository';
import { SubjectProgress }           from '../../../src/domain/entities/SubjectProgress';

const makeProgress = (completedAt: string | null = null): SubjectProgress =>
  new SubjectProgress({ id: 'uid1_sub1', studentUid: 'uid1', subjectId: 'sub1', courseId: 'c1', semesterId: 'sem1', state: completedAt ? 'completed' : 'not_started', completedAt, lastAccessedAt: null, lastAccessedLessonId: null });

const makeRepo = (): jest.Mocked<IProgressRepository> =>
  ({ findByStudentAndSubject: jest.fn(), findByCourseAndStudent: jest.fn(), findByCourse: jest.fn(), upsert: jest.fn(), deleteByStudentAndCourse: jest.fn(), revertCompletion: jest.fn() });

const INPUT = { studentUid: 'uid1', subjectId: 'sub1', courseId: 'c1', semesterId: 'sem1' };

describe('UpdateLastAccessedUseCase', () => {
  let repo:    jest.Mocked<IProgressRepository>;
  let useCase: UpdateLastAccessedUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new UpdateLastAccessedUseCase(repo);
  });

  it('updates lastAccessedAt', async () => {
    repo.findByStudentAndSubject.mockResolvedValue(makeProgress());
    repo.upsert.mockResolvedValue(undefined);

    const result = await useCase.execute(INPUT);
    expect(result.lastAccessedAt).not.toBeNull();
  });

  it('does not change completedAt when updating access on completed subject', async () => {
    const completed = makeProgress('2026-05-01T00:00:00.000Z');
    repo.findByStudentAndSubject.mockResolvedValue(completed);
    repo.upsert.mockResolvedValue(undefined);

    const result = await useCase.execute(INPUT);
    expect(result.completedAt).toBe('2026-05-01T00:00:00.000Z');
  });

  it('creates a new record when none exists', async () => {
    repo.findByStudentAndSubject.mockResolvedValue(null);
    repo.upsert.mockResolvedValue(undefined);

    const result = await useCase.execute(INPUT);
    expect(result.lastAccessedAt).not.toBeNull();
    expect(result.studentUid).toBe('uid1');
  });

  it('sets lastAccessedLessonId when lessonId is provided', async () => {
    repo.findByStudentAndSubject.mockResolvedValue(makeProgress());
    repo.upsert.mockResolvedValue(undefined);

    const result = await useCase.execute({ ...INPUT, lessonId: 'les-042' });
    expect(result.lastAccessedLessonId).toBe('les-042');
  });

  it('does not overwrite lastAccessedLessonId when lessonId is omitted', async () => {
    const existing = makeProgress();
    existing.lastAccessedLessonId = 'les-001';
    repo.findByStudentAndSubject.mockResolvedValue(existing);
    repo.upsert.mockResolvedValue(undefined);

    const result = await useCase.execute(INPUT);
    expect(result.lastAccessedLessonId).toBe('les-001');
  });
});
