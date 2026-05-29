import { UpdateSemesterUseCase } from '../../../src/application/use-cases/UpdateSemesterUseCase';
import { ISemesterRepository }  from '../../../src/domain/repositories/ISemesterRepository';
import { Semester }             from '../../../src/domain/entities/Semester';

const makeSemester = (): Semester =>
  new Semester({ id: 's1', courseId: 'c1', title: 'Old Title', subjectCount: 0, order: 1, deletedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

const makeSemesterRepo = (): jest.Mocked<ISemesterRepository> => ({
  findById:      jest.fn(),
  findByCourseId: jest.fn(),
  create:        jest.fn(),
  update:        jest.fn(),
  softDelete:    jest.fn(),
  hardDelete:    jest.fn(),
});

describe('UpdateSemesterUseCase', () => {
  let repo:    jest.Mocked<ISemesterRepository>;
  let useCase: UpdateSemesterUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeSemesterRepo();
    useCase = new UpdateSemesterUseCase(repo);
  });

  it('updates semester title and persists', async () => {
    repo.findById.mockResolvedValue(makeSemester());
    repo.update.mockResolvedValue(undefined);

    const result = await useCase.execute({ id: 's1', title: 'New Title' });

    expect(result.title).toBe('New Title');
    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Title' }));
  });

  it('throws 404 SEMESTER_NOT_FOUND when semester does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ id: 's1', title: 'X' })).rejects.toMatchObject({
      status:    404,
      errorCode: 'SEMESTER_NOT_FOUND',
    });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('propagates repo errors', async () => {
    repo.findById.mockResolvedValue(makeSemester());
    repo.update.mockRejectedValue(new Error('DB error'));
    await expect(useCase.execute({ id: 's1', title: 'X' })).rejects.toThrow('DB error');
  });
});
