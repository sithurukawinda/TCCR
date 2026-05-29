import { OpenBatchUseCase }           from '../../../src/application/use-cases/OpenBatchUseCase';
import { IBatchRepository }           from '../../../src/domain/repositories/IBatchRepository';
import { IBatchSemesterRepository }   from '../../../src/domain/repositories/IBatchSemesterRepository';
import { Batch, BatchProps }          from '../../../src/domain/entities/Batch';
import { BatchSemester }              from '../../../src/domain/entities/BatchSemester';

const makeBatch = (overrides: Partial<BatchProps> = {}): Batch =>
  new Batch({
    id:              'batch-1',
    courseId:        'course-1',
    name:            'Batch 2026',
    scheduledOpenAt: null,
    intakeStart:     '2026-06-01T00:00:00.000Z',
    intakeEnd:       '2026-08-31T00:00:00.000Z',
    capacity:        null,
    state:           'draft',
    createdAt:       '2026-01-01T00:00:00.000Z',
    updatedAt:       '2026-01-01T00:00:00.000Z',
    ...overrides,
  });

const makeBatchRepo = (): jest.Mocked<IBatchRepository> =>
  ({ findById: jest.fn(), findByCourseId: jest.fn(), create: jest.fn(), update: jest.fn() });

const makeBsRepo = (): jest.Mocked<IBatchSemesterRepository> =>
  ({ findByBatchId: jest.fn(), findBySemesterId: jest.fn(), upsertMany: jest.fn(), deleteBySemesterId: jest.fn(), deleteByBatchId: jest.fn() });

const makeScheduledBs = (semesterId: string): BatchSemester =>
  new BatchSemester({ id: `batch-1_${semesterId}`, batchId: 'batch-1', semesterId, courseId: 'course-1', openDate: '2026-06-01', endDate: '2026-06-30', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

describe('OpenBatchUseCase', () => {
  let batchRepo: jest.Mocked<IBatchRepository>;
  let bsRepo:    jest.Mocked<IBatchSemesterRepository>;
  let useCase:   OpenBatchUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    batchRepo = makeBatchRepo();
    bsRepo    = makeBsRepo();
    useCase   = new OpenBatchUseCase(batchRepo, bsRepo);
  });

  it('transitions a draft batch to open when all semesters are scheduled', async () => {
    batchRepo.findById.mockResolvedValue(makeBatch({ state: 'draft' }));
    bsRepo.findByBatchId.mockResolvedValue([makeScheduledBs('sem-1')]);
    batchRepo.update.mockResolvedValue(undefined);

    const batch = await useCase.execute('batch-1');

    expect(batch.state).toBe('open');
    expect(batchRepo.update).toHaveBeenCalledWith(batch);
  });

  it('throws 404 when batch not found', async () => {
    batchRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toMatchObject({
      status:    404,
      errorCode: 'BATCH_NOT_FOUND',
    });

    expect(batchRepo.update).not.toHaveBeenCalled();
  });

  it('throws 400 when batch has unscheduled semesters', async () => {
    batchRepo.findById.mockResolvedValue(makeBatch({ state: 'draft' }));
    const unscheduled = new BatchSemester({ id: 'batch-1_sem-2', batchId: 'batch-1', semesterId: 'sem-2', courseId: 'course-1', openDate: null, endDate: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
    bsRepo.findByBatchId.mockResolvedValue([unscheduled]);

    await expect(useCase.execute('batch-1')).rejects.toMatchObject({
      status:    400,
      errorCode: 'BATCH_SEMESTER_DATES_INCOMPLETE',
    });

    expect(batchRepo.update).not.toHaveBeenCalled();
  });

  it('throws 409 when batch is already open', async () => {
    batchRepo.findById.mockResolvedValue(makeBatch({ state: 'open' }));
    bsRepo.findByBatchId.mockResolvedValue([makeScheduledBs('sem-1')]);

    await expect(useCase.execute('batch-1')).rejects.toMatchObject({
      status:    409,
      errorCode: 'INVALID_STATE',
    });

    expect(batchRepo.update).not.toHaveBeenCalled();
  });

  it('throws 409 when batch is closed', async () => {
    batchRepo.findById.mockResolvedValue(makeBatch({ state: 'closed' }));
    bsRepo.findByBatchId.mockResolvedValue([makeScheduledBs('sem-1')]);

    await expect(useCase.execute('batch-1')).rejects.toMatchObject({
      status:    409,
      errorCode: 'INVALID_STATE',
    });

    expect(batchRepo.update).not.toHaveBeenCalled();
  });
});
