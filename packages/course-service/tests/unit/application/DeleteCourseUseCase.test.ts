import { DeleteCourseUseCase } from '../../../src/application/use-cases/DeleteCourseUseCase';
import { ICourseRepository }  from '../../../src/domain/repositories/ICourseRepository';
import { Course }             from '../../../src/domain/entities/Course';

const makeCourse = (): Course =>
  new Course({ id: 'c1', title: 'T', description: '', coverImageUrl: null, state: 'draft', createdBy: 'u1', semesterCount: 0, publishedAt: null, deletedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

const makeRepo = (): jest.Mocked<ICourseRepository> =>
  ({ findById: jest.fn(), findByTitle: jest.fn(), findPublished: jest.fn(), findAll: jest.fn(), create: jest.fn(), update: jest.fn(), softDelete: jest.fn() });

describe('DeleteCourseUseCase', () => {
  let repo:    jest.Mocked<ICourseRepository>;
  let useCase: DeleteCourseUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new DeleteCourseUseCase(repo);
  });

  it('soft-deletes an existing course', async () => {
    repo.findById.mockResolvedValue(makeCourse());
    repo.softDelete.mockResolvedValue(undefined);

    await useCase.execute('c1');
    expect(repo.softDelete).toHaveBeenCalledWith('c1');
  });

  it('throws 404 when course not found', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('c1')).rejects.toMatchObject({ status: 404, errorCode: 'COURSE_NOT_FOUND' });
    expect(repo.softDelete).not.toHaveBeenCalled();
  });
});
