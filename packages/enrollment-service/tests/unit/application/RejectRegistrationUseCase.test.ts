import { RejectRegistrationUseCase }  from '../../../src/application/use-cases/RejectRegistrationUseCase';
import { IRegistrationRepository }   from '../../../src/domain/repositories/IRegistrationRepository';
import { OutboxEventPublisher }      from '@shared/events';
import { Registration }              from '../../../src/domain/entities/Registration';

const makeReg = (state: 'pending' | 'approved' | 'rejected' = 'pending'): Registration =>
  new Registration({ id: 'uid-1', studentUid: 'uid-1', email: 'u@example.com', firstName: 'A', lastName: 'B', state, reason: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

const makeRepo = (): jest.Mocked<IRegistrationRepository> => ({
  findById: jest.fn(), findAll: jest.fn(), create: jest.fn(), update: jest.fn(),
});

const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn() } as unknown as jest.Mocked<OutboxEventPublisher>);

describe('RejectRegistrationUseCase', () => {
  let repo:    jest.Mocked<IRegistrationRepository>;
  let outbox:  jest.Mocked<OutboxEventPublisher>;
  let useCase: RejectRegistrationUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    outbox  = makeOutbox();
    useCase = new RejectRegistrationUseCase(repo, outbox);
  });

  it('rejects registration with reason and publishes event', async () => {
    repo.findById.mockResolvedValue(makeReg('pending'));
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute('uid-1', 'Incomplete application', 'req-1');

    expect(result.state).toBe('rejected');
    expect(result.reason).toBe('Incomplete application');
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'registration.rejected', payload: expect.objectContaining({ reason: 'Incomplete application' }) }),
    );
  });

  it('rejects registration without a reason', async () => {
    repo.findById.mockResolvedValue(makeReg('pending'));
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute('uid-1', undefined, 'req-1');

    expect(result.reason).toBeNull();
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ reason: null }) }),
    );
  });

  it('throws 404 ENROLLMENT_NOT_FOUND when registration does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('uid-1', 'reason', 'req-1')).rejects.toMatchObject({
      status:    404,
      errorCode: 'ENROLLMENT_NOT_FOUND',
    });
  });

  it('throws 409 INVALID_STATE when registration is already rejected', async () => {
    repo.findById.mockResolvedValue(makeReg('rejected'));
    await expect(useCase.execute('uid-1', 'reason', 'req-1')).rejects.toMatchObject({
      status:    409,
      errorCode: 'INVALID_STATE',
    });
  });
});
