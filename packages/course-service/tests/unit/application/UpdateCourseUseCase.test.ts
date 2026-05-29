import { UpdateCourseUseCase } from '../../../src/application/use-cases/UpdateCourseUseCase';
import { ICourseRepository }  from '../../../src/domain/repositories/ICourseRepository';
import { Course }             from '../../../src/domain/entities/Course';

const makeCourse = (overrides: Partial<{ title: string; state: string }> = {}): Course =>
  new Course({
    id: 'c1', title: overrides.title ?? 'Original Title', description: 'desc', coverImageUrl: null,
    state: (overrides.state as 'draft' | 'published' | 'archived') ?? 'draft',
    createdBy: 'u1', semesterCount: 0, publishedAt: null,
    deletedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  });

const makeRepo = (): jest.Mocked<ICourseRepository> => ({
  findById:      jest.fn(),
  findByTitle:   jest.fn(),
  findPublished: jest.fn(),
  findAll:       jest.fn(),
  create:        jest.fn(),
  update:        jest.fn(),
  softDelete:    jest.fn(),
  hardDelete:    jest.fn(),
});

describe('UpdateCourseUseCase', () => {
  let repo:    jest.Mocked<ICourseRepository>;
  let useCase: UpdateCourseUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new UpdateCourseUseCase(repo);
  });

  it('updates fields and persists the course', async () => {
    repo.findById.mockResolvedValue(makeCourse());
    repo.findByTitle.mockResolvedValue(null);
    repo.update.mockResolvedValue(undefined);

    const result = await useCase.execute({ id: 'c1', title: 'New Title', description: 'Updated' });

    expect(result.title).toBe('New Title');
    expect(result.description).toBe('Updated');
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it('throws 404 COURSE_NOT_FOUND when course does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ id: 'c1', title: 'X' })).rejects.toMatchObject({
      status:    404,
      errorCode: 'COURSE_NOT_FOUND',
    });
  });

  it('throws 409 COURSE_TITLE_EXISTS when new title is already taken', async () => {
    repo.findById.mockResolvedValue(makeCourse({ title: 'Original Title' }));
    repo.findByTitle.mockResolvedValue(makeCourse({ title: 'Taken Title' }));

    await expect(useCase.execute({ id: 'c1', title: 'Taken Title' })).rejects.toMatchObject({
      status:    409,
      errorCode: 'COURSE_TITLE_EXISTS',
    });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('skips title-uniqueness check when title is unchanged', async () => {
    repo.findById.mockResolvedValue(makeCourse({ title: 'Same Title' }));
    repo.update.mockResolvedValue(undefined);

    await useCase.execute({ id: 'c1', title: 'Same Title', description: 'Updated desc' });

    expect(repo.findByTitle).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledTimes(1);
  });
});
