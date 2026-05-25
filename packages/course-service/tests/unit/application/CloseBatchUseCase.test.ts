import { CloseBatchUseCase }  from '../../../src/application/use-cases/CloseBatchUseCase';
import { IBatchRepository }  from '../../../src/domain/repositories/IBatchRepository';
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
    state:           'open',
    createdAt:       '2026-01-01T00:00:00.000Z',
    updatedAt:       '2026-01-01T00:00:00.000Z',
    ...overrides,
  });

const makeBatchRepo = (): jest.Mocked<IBatchRepository> =>
  ({ findById: jest.fn(), findByCourseId: jest.fn(), create: jest.fn(), update: jest.fn() });

describe('CloseBatchUseCase', () => {
  let batchRepo: jest.Mocked<IBatchRepository>;
  let useCase:   CloseBatchUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    batchRepo = makeBatchRepo();
    useCase   = new CloseBatchUseCase(batchRepo);
  });

  it('transitions an open batch to closed', async () => {
    batchRepo.findById.mockResolvedValue(makeBatch({ state: 'open' }));
    batchRepo.update.mockResolvedValue(undefined);

    const batch = await useCase.execute('batch-1');

    expect(batch.state).toBe('closed');
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

  it('throws 409 when batch is still in draft', async () => {
    batchRepo.findById.mockResolvedValue(makeBatch({ state: 'draft' }));

    await expect(useCase.execute('batch-1')).rejects.toMatchObject({
      status:    409,
      errorCode: 'INVALID_STATE',
    });

    expect(batchRepo.update).not.toHaveBeenCalled();
  });

  it('throws 409 when batch is already closed', async () => {
    batchRepo.findById.mockResolvedValue(makeBatch({ state: 'closed' }));

    await expect(useCase.execute('batch-1')).rejects.toMatchObject({
      status:    409,
      errorCode: 'INVALID_STATE',
    });

    expect(batchRepo.update).not.toHaveBeenCalled();
  });
});
