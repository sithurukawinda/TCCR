import { UpdateSubjectUseCase } from '../../../src/application/use-cases/UpdateSubjectUseCase';
import { ISubjectRepository }  from '../../../src/domain/repositories/ISubjectRepository';
import { Subject }             from '../../../src/domain/entities/Subject';

const makeSubject = (): Subject =>
  new Subject({ id: 'sub1', semesterId: 's1', courseId: 'c1', title: 'Old Subject', order: 1, deletedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

const makeSubjectRepo = (): jest.Mocked<ISubjectRepository> => ({
  findById:       jest.fn(),
  findBySemesterId: jest.fn(),
  findByCourseId: jest.fn(),
  create:         jest.fn(),
  update:         jest.fn(),
  softDelete:     jest.fn(),
  hardDelete:     jest.fn(),
  deleteBySemesterId: jest.fn(),
});

describe('UpdateSubjectUseCase', () => {
  let repo:    jest.Mocked<ISubjectRepository>;
  let useCase: UpdateSubjectUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeSubjectRepo();
    useCase = new UpdateSubjectUseCase(repo);
  });

  it('updates subject title and persists', async () => {
    repo.findById.mockResolvedValue(makeSubject());
    repo.update.mockResolvedValue(undefined);

    const result = await useCase.execute({ id: 'sub1', title: 'New Subject Title' });

    expect(result.title).toBe('New Subject Title');
    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Subject Title' }));
  });

  it('throws 404 SUBJECT_NOT_FOUND when subject does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ id: 'sub1', title: 'X' })).rejects.toMatchObject({
      status:    404,
      errorCode: 'SUBJECT_NOT_FOUND',
    });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('propagates repo errors', async () => {
    repo.findById.mockResolvedValue(makeSubject());
    repo.update.mockRejectedValue(new Error('DB error'));
    await expect(useCase.execute({ id: 'sub1', title: 'X' })).rejects.toThrow('DB error');
  });
});
