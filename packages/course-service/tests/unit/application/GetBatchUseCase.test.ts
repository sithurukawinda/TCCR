import { GetBatchUseCase }  from '../../../src/application/use-cases/GetBatchUseCase';
import { IBatchRepository } from '../../../src/domain/repositories/IBatchRepository';
import { Batch }            from '../../../src/domain/entities/Batch';

const makeBatch = (): Batch =>
  new Batch({ id: 'batch-1', courseId: 'course-1', name: 'Batch 2026', scheduledOpenAt: null, intakeStart: '2026-06-01T00:00:00.000Z', intakeEnd: '2026-08-31T00:00:00.000Z', capacity: null, state: 'draft', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

const makeBatchRepo = (): jest.Mocked<IBatchRepository> =>
  ({ findById: jest.fn(), findByCourseId: jest.fn(), create: jest.fn(), update: jest.fn() });

describe('GetBatchUseCase', () => {
  let batchRepo: jest.Mocked<IBatchRepository>;
  let useCase:   GetBatchUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    batchRepo = makeBatchRepo();
    useCase   = new GetBatchUseCase(batchRepo);
  });

  it('returns the batch when found', async () => {
    const batch = makeBatch();
    batchRepo.findById.mockResolvedValue(batch);

    const result = await useCase.execute('batch-1');

    expect(result).toBe(batch);
    expect(batchRepo.findById).toHaveBeenCalledWith('batch-1');
  });

  it('throws 404 when batch not found', async () => {
    batchRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toMatchObject({
      status:    404,
      errorCode: 'BATCH_NOT_FOUND',
    });
  });
});
