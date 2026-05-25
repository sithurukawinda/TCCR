import { OpenBatchUseCase }  from '../../../src/application/use-cases/OpenBatchUseCase';
import { IBatchRepository } from '../../../src/domain/repositories/IBatchRepository';
import { Batch, BatchProps } from '../../../src/domain/entities/Batch';

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

describe('OpenBatchUseCase', () => {
  let batchRepo: jest.Mocked<IBatchRepository>;
  let useCase:   OpenBatchUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    batchRepo = makeBatchRepo();
    useCase   = new OpenBatchUseCase(batchRepo);
  });

  it('transitions a draft batch to open', async () => {
    batchRepo.findById.mockResolvedValue(makeBatch({ state: 'draft' }));
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

  it('throws 409 when batch is already open', async () => {
    batchRepo.findById.mockResolvedValue(makeBatch({ state: 'open' }));

    await expect(useCase.execute('batch-1')).rejects.toMatchObject({
      status:    409,
      errorCode: 'INVALID_STATE',
    });

    expect(batchRepo.update).not.toHaveBeenCalled();
  });

  it('throws 409 when batch is closed', async () => {
    batchRepo.findById.mockResolvedValue(makeBatch({ state: 'closed' }));

    await expect(useCase.execute('batch-1')).rejects.toMatchObject({
      status:    409,
      errorCode: 'INVALID_STATE',
    });

    expect(batchRepo.update).not.toHaveBeenCalled();
  });
});
