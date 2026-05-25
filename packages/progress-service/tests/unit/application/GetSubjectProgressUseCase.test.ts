import { GetSubjectProgressUseCase } from '../../../src/application/use-cases/GetSubjectProgressUseCase';
import { IProgressRepository }      from '../../../src/domain/repositories/IProgressRepository';
import { SubjectProgress }          from '../../../src/domain/entities/SubjectProgress';

const makeProgress = (): SubjectProgress =>
  new SubjectProgress({ id: 'uid-1_sub-1', studentUid: 'uid-1', subjectId: 'sub-1', courseId: 'c1', semesterId: 's1', state: 'in_progress', completedAt: null, lastAccessedAt: null });

const makeRepo = (): jest.Mocked<IProgressRepository> => ({
  findByStudentAndSubject: jest.fn(),
  findByCourseAndStudent:  jest.fn(),
  findByCourse:            jest.fn(),
  upsert:                  jest.fn(),
  deleteByStudentAndCourse: jest.fn(),
});

describe('GetSubjectProgressUseCase', () => {
  let repo:    jest.Mocked<IProgressRepository>;
  let useCase: GetSubjectProgressUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new GetSubjectProgressUseCase(repo);
  });

  it('returns the progress record when found', async () => {
    repo.findByStudentAndSubject.mockResolvedValue(makeProgress());

    const result = await useCase.execute('uid-1', 'sub-1');

    expect(result.studentUid).toBe('uid-1');
    expect(result.subjectId).toBe('sub-1');
    expect(repo.findByStudentAndSubject).toHaveBeenCalledWith('uid-1', 'sub-1');
  });

  it('throws 404 SUBJECT_NOT_FOUND when no progress record exists', async () => {
    repo.findByStudentAndSubject.mockResolvedValue(null);
    await expect(useCase.execute('uid-1', 'sub-1')).rejects.toMatchObject({
      status:    404,
      errorCode: 'SUBJECT_NOT_FOUND',
    });
  });

  it('propagates repo errors', async () => {
    repo.findByStudentAndSubject.mockRejectedValue(new Error('DB error'));
    await expect(useCase.execute('uid-1', 'sub-1')).rejects.toThrow('DB error');
  });
});
