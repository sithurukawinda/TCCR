import { ComputeCourseProgressUseCase }  from '../../../src/application/use-cases/ComputeCourseProgressUseCase';
import { IProgressRepository }           from '../../../src/domain/repositories/IProgressRepository';
import { ILessonProgressRepository }     from '../../../src/domain/repositories/ILessonProgressRepository';
import { CourseServiceClient }           from '../../../src/infrastructure/clients/CourseServiceClient';
import { SubjectProgress }               from '../../../src/domain/entities/SubjectProgress';

const makeProgress = (
  state: 'not_started' | 'completed',
  subjectId: string,
  lastAccessedAt: string | null = null,
  lastAccessedLessonId: string | null = null,
): SubjectProgress =>
  new SubjectProgress({
    id: `uid1_${subjectId}`, studentUid: 'uid1', subjectId, courseId: 'c1', semesterId: 'sem1',
    state, completedAt: state === 'completed' ? '2026-05-01T00:00:00.000Z' : null,
    lastAccessedAt, lastAccessedLessonId,
  });

const makeRepo = (): jest.Mocked<IProgressRepository> =>
  ({ findByStudentAndSubject: jest.fn(), findByCourseAndStudent: jest.fn(), findByCourse: jest.fn(), upsert: jest.fn(), deleteByStudentAndCourse: jest.fn(), revertCompletion: jest.fn() });

const makeLessonRepo = (): jest.Mocked<ILessonProgressRepository> =>
  ({ findByStudentAndLesson: jest.fn(), findByCourseAndStudent: jest.fn(), findBySubjectAndStudent: jest.fn(), save: jest.fn(), delete: jest.fn() } as unknown as jest.Mocked<ILessonProgressRepository>);

const makeClient = (): jest.Mocked<CourseServiceClient> =>
  ({ getSubjectCount: jest.fn(), getCourseLessonCount: jest.fn() } as unknown as jest.Mocked<CourseServiceClient>);

describe('ComputeCourseProgressUseCase', () => {
  let repo:        jest.Mocked<IProgressRepository>;
  let lessonRepo:  jest.Mocked<ILessonProgressRepository>;
  let client:      jest.Mocked<CourseServiceClient>;
  let useCase:     ComputeCourseProgressUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    lessonRepo = makeLessonRepo();
    client     = makeClient();
    useCase    = new ComputeCourseProgressUseCase(repo, lessonRepo, client);
    lessonRepo.findByCourseAndStudent.mockResolvedValue([]);
    client.getCourseLessonCount.mockResolvedValue(0);
  });

  it('returns 0% when no subjects are completed', async () => {
    client.getSubjectCount.mockResolvedValue(3);
    repo.findByCourseAndStudent.mockResolvedValue([makeProgress('not_started', 'sub1'), makeProgress('not_started', 'sub2'), makeProgress('not_started', 'sub3')]);
    const result = await useCase.execute('uid1', 'c1');
    expect(result.completionPercent).toBe(0);
    expect(result.completedCount).toBe(0);
    expect(result.totalSubjects).toBe(3);
  });

  it('returns 33.3% when 1 of 3 subjects is completed', async () => {
    client.getSubjectCount.mockResolvedValue(3);
    repo.findByCourseAndStudent.mockResolvedValue([makeProgress('completed', 'sub1'), makeProgress('not_started', 'sub2'), makeProgress('not_started', 'sub3')]);
    const result = await useCase.execute('uid1', 'c1');
    expect(result.completionPercent).toBe(33.3);
  });

  it('returns 100% when all subjects are completed', async () => {
    client.getSubjectCount.mockResolvedValue(2);
    repo.findByCourseAndStudent.mockResolvedValue([makeProgress('completed', 'sub1'), makeProgress('completed', 'sub2')]);
    const result = await useCase.execute('uid1', 'c1');
    expect(result.completionPercent).toBe(100);
  });

  it('returns 0% without division-by-zero when totalSubjects is 0', async () => {
    client.getSubjectCount.mockResolvedValue(0);
    repo.findByCourseAndStudent.mockResolvedValue([]);
    const result = await useCase.execute('uid1', 'c1');
    expect(result.completionPercent).toBe(0);
    expect(result.totalSubjects).toBe(0);
  });

  it('returns the most recently accessed subject ID', async () => {
    client.getSubjectCount.mockResolvedValue(2);
    repo.findByCourseAndStudent.mockResolvedValue([
      makeProgress('not_started', 'sub1', '2026-05-01T09:00:00.000Z'),
      makeProgress('not_started', 'sub2', '2026-05-01T10:00:00.000Z'),
    ]);
    const result = await useCase.execute('uid1', 'c1');
    expect(result.lastAccessedSubjectId).toBe('sub2');
  });

  it('returns lastAccessedLessonId from the most recently accessed record', async () => {
    client.getSubjectCount.mockResolvedValue(2);
    repo.findByCourseAndStudent.mockResolvedValue([
      makeProgress('not_started', 'sub1', '2026-05-01T09:00:00.000Z', 'les-001'),
      makeProgress('not_started', 'sub2', '2026-05-01T10:00:00.000Z', 'les-007'),
    ]);
    const result = await useCase.execute('uid1', 'c1');
    expect(result.lastAccessedLessonId).toBe('les-007');
  });

  it('returns null lastAccessedLessonId when no lesson has been accessed', async () => {
    client.getSubjectCount.mockResolvedValue(1);
    repo.findByCourseAndStudent.mockResolvedValue([makeProgress('not_started', 'sub1')]);
    const result = await useCase.execute('uid1', 'c1');
    expect(result.lastAccessedLessonId).toBeNull();
  });
});
