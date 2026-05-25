import { GetBatchesUseCase } from '../../../src/application/use-cases/GetBatchesUseCase';
import { IBatchRepository }  from '../../../src/domain/repositories/IBatchRepository';
import { Batch }             from '../../../src/domain/entities/Batch';

const makeBatch = (id: string): Batch =>
  new Batch({ id, courseId: 'course-1', name: `Batch ${id}`, scheduledOpenAt: null, intakeStart: '2026-06-01T00:00:00.000Z', intakeEnd: '2026-08-31T00:00:00.000Z', capacity: null, state: 'draft', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

const makeBatchRepo = (): jest.Mocked<IBatchRepository> =>
  ({ findById: jest.fn(), findByCourseId: jest.fn(), create: jest.fn(), update: jest.fn() });

describe('GetBatchesUseCase', () => {
  let batchRepo: jest.Mocked<IBatchRepository>;
  let useCase:   GetBatchesUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    batchRepo = makeBatchRepo();
    useCase   = new GetBatchesUseCase(batchRepo);
  });

  it('returns all batches for a course', async () => {
    const batches = [makeBatch('b1'), makeBatch('b2')];
    batchRepo.findByCourseId.mockResolvedValue(batches);

    const result = await useCase.execute('course-1');

    expect(result).toHaveLength(2);
    expect(batchRepo.findByCourseId).toHaveBeenCalledWith('course-1');
  });

  it('returns an empty array when the course has no batches', async () => {
    batchRepo.findByCourseId.mockResolvedValue([]);

    const result = await useCase.execute('course-1');

    expect(result).toEqual([]);
  });
});
