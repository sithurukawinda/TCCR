import { CreateCourseUseCase } from '../../../src/application/use-cases/CreateCourseUseCase';
import { ICourseRepository }  from '../../../src/domain/repositories/ICourseRepository';
import { Course }             from '../../../src/domain/entities/Course';

const makeCourse = (): Course =>
  new Course({
    id: 'c1', title: 'Existing Title', description: '', coverImageUrl: null,
    state: 'draft', createdBy: 'u1', semesterCount: 0, publishedAt: null,
    deletedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  });

const makeRepo = (): jest.Mocked<ICourseRepository> => ({
  findById:    jest.fn(),
  findByTitle: jest.fn(),
  findPublished: jest.fn(),
  findAll:     jest.fn(),
  create:      jest.fn(),
  update:      jest.fn(),
  softDelete:  jest.fn(),
  hardDelete:  jest.fn(),
});

describe('CreateCourseUseCase', () => {
  let repo:    jest.Mocked<ICourseRepository>;
  let useCase: CreateCourseUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new CreateCourseUseCase(repo);
  });

  it('creates a course with state=draft and semesterCount=0', async () => {
    repo.findByTitle.mockResolvedValue(null);
    repo.create.mockResolvedValue(undefined);

    const course = await useCase.execute({ title: 'New Course', createdBy: 'u1' });

    expect(course.title).toBe('New Course');
    expect(course.state).toBe('draft');
    expect(course.semesterCount).toBe(0);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Course', state: 'draft' }));
  });

  it('throws 409 COURSE_TITLE_EXISTS when title already taken', async () => {
    repo.findByTitle.mockResolvedValue(makeCourse());
    await expect(useCase.execute({ title: 'Existing Title', createdBy: 'u1' })).rejects.toMatchObject({
      status:    409,
      errorCode: 'COURSE_TITLE_EXISTS',
    });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('uses provided description and coverImageUrl', async () => {
    repo.findByTitle.mockResolvedValue(null);
    repo.create.mockResolvedValue(undefined);

    const course = await useCase.execute({
      title: 'Rich Course', description: 'A great course', coverImageUrl: 'http://img.jpg', createdBy: 'u1',
    });

    expect(course.description).toBe('A great course');
    expect(course.coverImageUrl).toBe('http://img.jpg');
  });

  it('defaults description to empty string and coverImageUrl to null', async () => {
    repo.findByTitle.mockResolvedValue(null);
    repo.create.mockResolvedValue(undefined);

    const course = await useCase.execute({ title: 'Minimal Course', createdBy: 'u1' });

    expect(course.description).toBe('');
    expect(course.coverImageUrl).toBeNull();
  });
});
