import { CreateBatchUseCase }        from '../../../src/application/use-cases/CreateBatchUseCase';
import { ICourseRepository }          from '../../../src/domain/repositories/ICourseRepository';
import { IBatchRepository }           from '../../../src/domain/repositories/IBatchRepository';
import { ISemesterRepository }        from '../../../src/domain/repositories/ISemesterRepository';
import { IBatchSemesterRepository }   from '../../../src/domain/repositories/IBatchSemesterRepository';
import { Course }                     from '../../../src/domain/entities/Course';

const makeCourse = (): Course =>
  new Course({ id: 'course-1', title: 'T', description: '', coverImageUrl: null, state: 'draft', createdBy: 'u1', semesterCount: 0, publishedAt: null, deletedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

const makeCourseRepo = (): jest.Mocked<ICourseRepository> =>
  ({ findById: jest.fn(), findByTitle: jest.fn(), findPublished: jest.fn(), findAll: jest.fn(), create: jest.fn(), update: jest.fn(), softDelete: jest.fn(), hardDelete: jest.fn() });

const makeBatchRepo = (): jest.Mocked<IBatchRepository> =>
  ({ findById: jest.fn(), findByCourseId: jest.fn(), create: jest.fn(), update: jest.fn() });

const makeSemesterRepo = (): jest.Mocked<ISemesterRepository> =>
  ({ findById: jest.fn(), findByCourseId: jest.fn(), create: jest.fn(), update: jest.fn(), softDelete: jest.fn(), hardDelete: jest.fn() });

const makeBsRepo = (): jest.Mocked<IBatchSemesterRepository> =>
  ({ findByBatchId: jest.fn(), findBySemesterId: jest.fn(), upsertMany: jest.fn(), deleteBySemesterId: jest.fn(), deleteByBatchId: jest.fn() });

const FUTURE = '2099-01-01T00:00:00.000Z';
const PAST   = '2000-01-01T00:00:00.000Z';

const baseInput = {
  name:            'Batch 2026',
  scheduledOpenAt: null,
  intakeStart:     '2026-06-01T00:00:00.000Z',
  intakeEnd:       '2026-08-31T00:00:00.000Z',
  capacity:        null,
};

describe('CreateBatchUseCase', () => {
  let courseRepo:   jest.Mocked<ICourseRepository>;
  let batchRepo:    jest.Mocked<IBatchRepository>;
  let semesterRepo: jest.Mocked<ISemesterRepository>;
  let bsRepo:       jest.Mocked<IBatchSemesterRepository>;
  let useCase:      CreateBatchUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    courseRepo   = makeCourseRepo();
    batchRepo    = makeBatchRepo();
    semesterRepo = makeSemesterRepo();
    bsRepo       = makeBsRepo();
    useCase      = new CreateBatchUseCase(courseRepo, batchRepo, semesterRepo, bsRepo);
  });

  it('creates a draft batch when scheduledOpenAt is null', async () => {
    courseRepo.findById.mockResolvedValue(makeCourse());
    batchRepo.create.mockResolvedValue(undefined);
    semesterRepo.findByCourseId.mockResolvedValue([]);
    bsRepo.upsertMany.mockResolvedValue(undefined);

    const batch = await useCase.execute('course-1', baseInput);

    expect(batch.courseId).toBe('course-1');
    expect(batch.name).toBe('Batch 2026');
    expect(batch.state).toBe('draft');
    expect(batchRepo.create).toHaveBeenCalledWith(batch);
  });

  it('creates a draft batch when scheduledOpenAt is in the future', async () => {
    courseRepo.findById.mockResolvedValue(makeCourse());
    batchRepo.create.mockResolvedValue(undefined);
    semesterRepo.findByCourseId.mockResolvedValue([]);
    bsRepo.upsertMany.mockResolvedValue(undefined);

    const batch = await useCase.execute('course-1', { ...baseInput, scheduledOpenAt: FUTURE });

    expect(batch.state).toBe('draft');
  });

  it('auto-opens the batch when scheduledOpenAt is in the past', async () => {
    courseRepo.findById.mockResolvedValue(makeCourse());
    batchRepo.create.mockResolvedValue(undefined);
    semesterRepo.findByCourseId.mockResolvedValue([]);
    bsRepo.upsertMany.mockResolvedValue(undefined);

    const batch = await useCase.execute('course-1', { ...baseInput, scheduledOpenAt: PAST });

    expect(batch.state).toBe('open');
    expect(batchRepo.create).toHaveBeenCalledWith(batch);
  });

  it('throws 404 when course not found', async () => {
    courseRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing', baseInput)).rejects.toMatchObject({
      status:    404,
      errorCode: 'COURSE_NOT_FOUND',
    });

    expect(batchRepo.create).not.toHaveBeenCalled();
  });
});
