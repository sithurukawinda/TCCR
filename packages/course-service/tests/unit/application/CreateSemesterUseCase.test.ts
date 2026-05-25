import { CreateSemesterUseCase } from '../../../src/application/use-cases/CreateSemesterUseCase';
import { ICourseRepository }    from '../../../src/domain/repositories/ICourseRepository';
import { ISemesterRepository }  from '../../../src/domain/repositories/ISemesterRepository';
import { Course }               from '../../../src/domain/entities/Course';

const makeCourse = (): Course =>
  new Course({ id: 'c1', title: 'T', description: '', coverImageUrl: null, state: 'draft', createdBy: 'u1', semesterCount: 0, publishedAt: null, deletedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

const makeCourseRepo = (): jest.Mocked<ICourseRepository> =>
  ({ findById: jest.fn(), findByTitle: jest.fn(), findPublished: jest.fn(), findAll: jest.fn(), create: jest.fn(), update: jest.fn(), softDelete: jest.fn() });

const makeSemesterRepo = (): jest.Mocked<ISemesterRepository> =>
  ({ findById: jest.fn(), findByCourseId: jest.fn(), create: jest.fn(), update: jest.fn(), softDelete: jest.fn() });

describe('CreateSemesterUseCase', () => {
  let courseRepo:   jest.Mocked<ICourseRepository>;
  let semesterRepo: jest.Mocked<ISemesterRepository>;
  let useCase:      CreateSemesterUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    courseRepo   = makeCourseRepo();
    semesterRepo = makeSemesterRepo();
    useCase      = new CreateSemesterUseCase(courseRepo, semesterRepo);
  });

  it('creates a semester and increments semesterCount', async () => {
    courseRepo.findById.mockResolvedValue(makeCourse());
    semesterRepo.findByCourseId.mockResolvedValue([]);
    semesterRepo.create.mockResolvedValue(undefined);
    courseRepo.update.mockResolvedValue(undefined);

    const semester = await useCase.execute({ courseId: 'c1', title: 'Sem 1' });

    expect(semester.courseId).toBe('c1');
    expect(semester.subjectCount).toBe(0);
    expect(semester.order).toBe(1);
    expect(courseRepo.update).toHaveBeenCalledWith(expect.objectContaining({ semesterCount: 1 }));
  });

  it('throws 404 when course not found', async () => {
    courseRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ courseId: 'c1', title: 'S' })).rejects.toMatchObject({ status: 404, errorCode: 'COURSE_NOT_FOUND' });
  });
});
