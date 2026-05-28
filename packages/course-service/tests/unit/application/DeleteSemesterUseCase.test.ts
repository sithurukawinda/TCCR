import { DeleteSemesterUseCase }      from '../../../src/application/use-cases/DeleteSemesterUseCase';
import { ICourseRepository }          from '../../../src/domain/repositories/ICourseRepository';
import { ISemesterRepository }        from '../../../src/domain/repositories/ISemesterRepository';
import { IBatchSemesterRepository }   from '../../../src/domain/repositories/IBatchSemesterRepository';
import { Course }                     from '../../../src/domain/entities/Course';
import { Semester }                   from '../../../src/domain/entities/Semester';

const makeCourse = (semesterCount = 2): Course =>
  new Course({
    id: 'c1', title: 'T', description: '', coverImageUrl: null, state: 'draft',
    createdBy: 'u1', semesterCount, publishedAt: null,
    deletedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  });

const makeSemester = (): Semester =>
  new Semester({ id: 's1', courseId: 'c1', title: 'S1', subjectCount: 0, order: 1, deletedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

const makeCourseRepo = (): jest.Mocked<ICourseRepository> => ({
  findById: jest.fn(), findByTitle: jest.fn(), findPublished: jest.fn(),
  findAll: jest.fn(), create: jest.fn(), update: jest.fn(), softDelete: jest.fn(),
});

const makeSemesterRepo = (): jest.Mocked<ISemesterRepository> => ({
  findById: jest.fn(), findByCourseId: jest.fn(), create: jest.fn(), update: jest.fn(), softDelete: jest.fn(),
});

const makeBsRepo = (): jest.Mocked<IBatchSemesterRepository> =>
  ({ findByBatchId: jest.fn(), findBySemesterId: jest.fn(), upsertMany: jest.fn(), deleteBySemesterId: jest.fn(), deleteByBatchId: jest.fn() });

describe('DeleteSemesterUseCase', () => {
  let courseRepo:   jest.Mocked<ICourseRepository>;
  let semesterRepo: jest.Mocked<ISemesterRepository>;
  let bsRepo:       jest.Mocked<IBatchSemesterRepository>;
  let useCase:      DeleteSemesterUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    courseRepo   = makeCourseRepo();
    semesterRepo = makeSemesterRepo();
    bsRepo       = makeBsRepo();
    useCase      = new DeleteSemesterUseCase(courseRepo, semesterRepo, bsRepo);
  });

  it('soft-deletes semester and decrements course semesterCount', async () => {
    semesterRepo.findById.mockResolvedValue(makeSemester());
    semesterRepo.softDelete.mockResolvedValue(undefined);
    bsRepo.deleteBySemesterId.mockResolvedValue(undefined);
    courseRepo.findById.mockResolvedValue(makeCourse(2));
    courseRepo.update.mockResolvedValue(undefined);

    await useCase.execute('s1');

    expect(semesterRepo.softDelete).toHaveBeenCalledWith('s1');
    expect(bsRepo.deleteBySemesterId).toHaveBeenCalledWith('s1');
    expect(courseRepo.update).toHaveBeenCalledWith(expect.objectContaining({ semesterCount: 1 }));
  });

  it('throws 404 SEMESTER_NOT_FOUND when semester does not exist', async () => {
    semesterRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('s1')).rejects.toMatchObject({
      status:    404,
      errorCode: 'SEMESTER_NOT_FOUND',
    });
    expect(semesterRepo.softDelete).not.toHaveBeenCalled();
  });

  it('does not decrement count below zero', async () => {
    semesterRepo.findById.mockResolvedValue(makeSemester());
    semesterRepo.softDelete.mockResolvedValue(undefined);
    bsRepo.deleteBySemesterId.mockResolvedValue(undefined);
    courseRepo.findById.mockResolvedValue(makeCourse(0));
    courseRepo.update.mockResolvedValue(undefined);

    await useCase.execute('s1');

    expect(courseRepo.update).not.toHaveBeenCalled();
  });

  it('skips course update if course not found after semester delete', async () => {
    semesterRepo.findById.mockResolvedValue(makeSemester());
    semesterRepo.softDelete.mockResolvedValue(undefined);
    bsRepo.deleteBySemesterId.mockResolvedValue(undefined);
    courseRepo.findById.mockResolvedValue(null);

    await useCase.execute('s1');

    expect(courseRepo.update).not.toHaveBeenCalled();
  });
});
