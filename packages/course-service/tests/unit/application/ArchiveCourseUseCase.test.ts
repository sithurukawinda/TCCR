import { ArchiveCourseUseCase } from '../../../src/application/use-cases/ArchiveCourseUseCase';
import { ICourseRepository }   from '../../../src/domain/repositories/ICourseRepository';
import { Course }              from '../../../src/domain/entities/Course';

const makeCourse = (state: 'draft' | 'published' | 'archived' = 'published'): Course =>
  new Course({ id: 'c1', title: 'T', description: '', coverImageUrl: null, state, createdBy: 'u1', semesterCount: 1, publishedAt: '2026-01-01T00:00:00.000Z', deletedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

const makeRepo = (): jest.Mocked<ICourseRepository> =>
  ({ findById: jest.fn(), findByTitle: jest.fn(), findPublished: jest.fn(), findAll: jest.fn(), create: jest.fn(), update: jest.fn(), softDelete: jest.fn() });

describe('ArchiveCourseUseCase', () => {
  let repo:    jest.Mocked<ICourseRepository>;
  let useCase: ArchiveCourseUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new ArchiveCourseUseCase(repo);
  });

  it('archives a PUBLISHED course', async () => {
    repo.findById.mockResolvedValue(makeCourse('published'));
    repo.update.mockResolvedValue(undefined);

    const course = await useCase.execute('c1');
    expect(course.state).toBe('archived');
  });

  it('throws 404 when course not found', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('c1')).rejects.toMatchObject({ status: 404 });
  });

  it('throws 409 INVALID_STATE when course is DRAFT', async () => {
    repo.findById.mockResolvedValue(makeCourse('draft'));
    await expect(useCase.execute('c1')).rejects.toMatchObject({ status: 409, errorCode: 'INVALID_STATE' });
  });
});
