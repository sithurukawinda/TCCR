import { RestoreCourseUseCase } from '../../../src/application/use-cases/RestoreCourseUseCase';
import { ICourseRepository }   from '../../../src/domain/repositories/ICourseRepository';
import { Course }              from '../../../src/domain/entities/Course';

const makeCourse = (state: 'draft' | 'published' | 'archived' = 'archived'): Course =>
  new Course({
    id: 'c1', title: 'T', description: '', coverImageUrl: null, state,
    createdBy: 'u1', semesterCount: 2,
    publishedAt: state === 'draft' ? null : '2026-01-01T00:00:00.000Z',
    deletedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  });

const makeRepo = (): jest.Mocked<ICourseRepository> => ({
  findById:     jest.fn(),
  findByTitle:  jest.fn(),
  findPublished: jest.fn(),
  findAll:      jest.fn(),
  create:       jest.fn(),
  update:       jest.fn(),
  softDelete:   jest.fn(),
  hardDelete:   jest.fn(),
});

describe('RestoreCourseUseCase', () => {
  let repo:    jest.Mocked<ICourseRepository>;
  let useCase: RestoreCourseUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new RestoreCourseUseCase(repo);
  });

  it('restores an ARCHIVED course to DRAFT', async () => {
    repo.findById.mockResolvedValue(makeCourse('archived'));
    repo.update.mockResolvedValue(undefined);

    const course = await useCase.execute('c1');

    expect(course.state).toBe('draft');
    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ state: 'draft' }));
  });

  it('updates updatedAt on restore', async () => {
    const before = new Date('2026-01-01T00:00:00.000Z').getTime();
    repo.findById.mockResolvedValue(makeCourse('archived'));
    repo.update.mockResolvedValue(undefined);

    const course = await useCase.execute('c1');

    expect(new Date(course.updatedAt).getTime()).toBeGreaterThan(before);
  });

  it('throws 404 COURSE_NOT_FOUND when course does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('c1')).rejects.toMatchObject({
      status: 404, errorCode: 'COURSE_NOT_FOUND',
    });
  });

  it('throws 409 INVALID_STATE when course is DRAFT', async () => {
    repo.findById.mockResolvedValue(makeCourse('draft'));
    await expect(useCase.execute('c1')).rejects.toMatchObject({
      status: 409, errorCode: 'INVALID_STATE',
    });
  });

  it('throws 409 INVALID_STATE when course is PUBLISHED', async () => {
    repo.findById.mockResolvedValue(makeCourse('published'));
    await expect(useCase.execute('c1')).rejects.toMatchObject({
      status: 409, errorCode: 'INVALID_STATE',
    });
  });

  it('does not call update when findById throws', async () => {
    repo.findById.mockRejectedValue(new Error('DB error'));
    await expect(useCase.execute('c1')).rejects.toThrow('DB error');
    expect(repo.update).not.toHaveBeenCalled();
  });
});
