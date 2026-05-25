import { BulkApproveRegistrationsUseCase } from '../../../src/application/use-cases/BulkApproveRegistrationsUseCase';
import { ApproveRegistrationUseCase }      from '../../../src/application/use-cases/ApproveRegistrationUseCase';
import { Registration }                    from '../../../src/domain/entities/Registration';

const makeReg = (id: string): Registration =>
  new Registration({ id, studentUid: id, email: `${id}@x.com`, firstName: 'A', lastName: 'B', state: 'approved', reason: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

const makeApproveUC = (): jest.Mocked<ApproveRegistrationUseCase> =>
  ({ execute: jest.fn() } as unknown as jest.Mocked<ApproveRegistrationUseCase>);

describe('BulkApproveRegistrationsUseCase', () => {
  let approveUC: jest.Mocked<ApproveRegistrationUseCase>;
  let useCase:   BulkApproveRegistrationsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    approveUC = makeApproveUC();
    useCase   = new BulkApproveRegistrationsUseCase(approveUC);
  });

  it('returns all as approved when all succeed', async () => {
    approveUC.execute.mockResolvedValueOnce(makeReg('r1')).mockResolvedValueOnce(makeReg('r2'));
    const result = await useCase.execute(['r1', 'r2'], 'req-1');
    expect(result.approved).toEqual(['r1', 'r2']);
    expect(result.failed).toHaveLength(0);
  });

  it('handles partial success — some approved, some failed', async () => {
    approveUC.execute
      .mockResolvedValueOnce(makeReg('r1'))
      .mockRejectedValueOnce(new Error('Already approved'));
    const result = await useCase.execute(['r1', 'r2'], 'req-1');
    expect(result.approved).toEqual(['r1']);
    expect(result.failed).toEqual([{ id: 'r2', reason: 'Already approved' }]);
  });

  it('returns all as failed when all fail', async () => {
    approveUC.execute.mockRejectedValue(new Error('Not found'));
    const result = await useCase.execute(['r1', 'r2'], 'req-1');
    expect(result.approved).toHaveLength(0);
    expect(result.failed).toHaveLength(2);
  });
});
