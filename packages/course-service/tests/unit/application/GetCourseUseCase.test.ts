import { GetCourseUseCase }          from '../../../src/application/use-cases/GetCourseUseCase';
import { ICourseRepository }         from '../../../src/domain/repositories/ICourseRepository';
import { ISemesterRepository }       from '../../../src/domain/repositories/ISemesterRepository';
import { ISubjectRepository }        from '../../../src/domain/repositories/ISubjectRepository';
import { IBatchRepository }          from '../../../src/domain/repositories/IBatchRepository';
import { IBatchSemesterRepository }  from '../../../src/domain/repositories/IBatchSemesterRepository';
import { Course }                    from '../../../src/domain/entities/Course';
import { Semester }                  from '../../../src/domain/entities/Semester';
import { Subject }                   from '../../../src/domain/entities/Subject';

const makeCourse = (state: 'draft' | 'published' | 'archived' = 'published'): Course =>
  new Course({
    id: 'c1', title: 'T', description: '', coverImageUrl: null, state,
    createdBy: 'u1', semesterCount: 1, publishedAt: null,
    deletedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  });

const makeSemester = (): Semester =>
  new Semester({ id: 's1', courseId: 'c1', title: 'S1', subjectCount: 1, order: 1, deletedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

const makeSubject = (): Subject =>
  new Subject({ id: 'sub1', semesterId: 's1', courseId: 'c1', title: 'Sub1', order: 1, deletedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

const makeCourseRepo = (): jest.Mocked<ICourseRepository> => ({
  findById: jest.fn(), findByTitle: jest.fn(), findPublished: jest.fn(),
  findAll: jest.fn(), create: jest.fn(), update: jest.fn(), softDelete: jest.fn(),
});

const makeSemesterRepo = (): jest.Mocked<ISemesterRepository> => ({
  findById: jest.fn(), findByCourseId: jest.fn(), create: jest.fn(), update: jest.fn(), softDelete: jest.fn(),
});

const makeSubjectRepo = (): jest.Mocked<ISubjectRepository> => ({
  findById: jest.fn(), findBySemesterId: jest.fn(), findByCourseId: jest.fn(),
  create: jest.fn(), update: jest.fn(), softDelete: jest.fn(),
});

const makeBatchRepo = (): jest.Mocked<IBatchRepository> =>
  ({ findById: jest.fn(), findByCourseId: jest.fn(), create: jest.fn(), update: jest.fn() });

const makeBsRepo = (): jest.Mocked<IBatchSemesterRepository> =>
  ({ findByBatchId: jest.fn(), findBySemesterId: jest.fn(), upsertMany: jest.fn(), deleteBySemesterId: jest.fn(), deleteByBatchId: jest.fn() });

describe('GetCourseUseCase', () => {
  let courseRepo:   jest.Mocked<ICourseRepository>;
  let semesterRepo: jest.Mocked<ISemesterRepository>;
  let subjectRepo:  jest.Mocked<ISubjectRepository>;
  let batchRepo:    jest.Mocked<IBatchRepository>;
  let bsRepo:       jest.Mocked<IBatchSemesterRepository>;
  let useCase:      GetCourseUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    courseRepo   = makeCourseRepo();
    semesterRepo = makeSemesterRepo();
    subjectRepo  = makeSubjectRepo();
    batchRepo    = makeBatchRepo();
    bsRepo       = makeBsRepo();
    useCase      = new GetCourseUseCase(courseRepo, semesterRepo, subjectRepo, batchRepo, bsRepo);
  });

  it('returns course detail with semesters and subjects for admin', async () => {
    courseRepo.findById.mockResolvedValue(makeCourse('draft'));
    semesterRepo.findByCourseId.mockResolvedValue([makeSemester()]);
    subjectRepo.findBySemesterId.mockResolvedValue([makeSubject()]);
    batchRepo.findByCourseId.mockResolvedValue([]);
    bsRepo.findByBatchId.mockResolvedValue([]);

    const result = await useCase.execute('c1', true);

    expect(result.id).toBe('c1');
    expect(result.semesters).toHaveLength(1);
    expect(result.semesters[0].subjects).toHaveLength(1);
  });

  it('returns published course for non-admin', async () => {
    courseRepo.findById.mockResolvedValue(makeCourse('published'));
    semesterRepo.findByCourseId.mockResolvedValue([]);
    subjectRepo.findBySemesterId.mockResolvedValue([]);
    batchRepo.findByCourseId.mockResolvedValue([]);
    bsRepo.findByBatchId.mockResolvedValue([]);

    const result = await useCase.execute('c1', false);

    expect(result.state).toBe('published');
  });

  it('throws 404 for non-admin when course is draft', async () => {
    courseRepo.findById.mockResolvedValue(makeCourse('draft'));
    await expect(useCase.execute('c1', false)).rejects.toMatchObject({ status: 404, errorCode: 'COURSE_NOT_FOUND' });
  });

  it('throws 404 when course does not exist', async () => {
    courseRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('c1', true)).rejects.toMatchObject({ status: 404, errorCode: 'COURSE_NOT_FOUND' });
  });

  it('throws 404 when course is soft-deleted', async () => {
    const deleted = makeCourse('published');
    deleted.deletedAt = '2026-01-01T00:00:00.000Z';
    courseRepo.findById.mockResolvedValue(deleted);
    await expect(useCase.execute('c1', true)).rejects.toMatchObject({ status: 404 });
  });
});
