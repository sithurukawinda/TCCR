import { ApproveRegistrationUseCase } from '../../../src/application/use-cases/ApproveRegistrationUseCase';
import { IRegistrationRepository }   from '../../../src/domain/repositories/IRegistrationRepository';
import { UserServiceClient }         from '../../../src/infrastructure/clients/UserServiceClient';
import { OutboxEventPublisher }      from '@shared/events';
import { Registration }              from '../../../src/domain/entities/Registration';

const makeReg = (state: 'pending' | 'approved' | 'rejected' = 'pending'): Registration =>
  new Registration({ id: 'uid-1', studentUid: 'uid-1', email: 'u@example.com', firstName: 'A', lastName: 'B', state, reason: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

const makeRepo = (): jest.Mocked<IRegistrationRepository> => ({
  findById: jest.fn(), findAll: jest.fn(), create: jest.fn(), update: jest.fn(),
});

const makeUserClient = (): jest.Mocked<UserServiceClient> =>
  ({ approveUser: jest.fn() } as unknown as jest.Mocked<UserServiceClient>);

const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn() } as unknown as jest.Mocked<OutboxEventPublisher>);

describe('ApproveRegistrationUseCase', () => {
  let repo:       jest.Mocked<IRegistrationRepository>;
  let userClient: jest.Mocked<UserServiceClient>;
  let outbox:     jest.Mocked<OutboxEventPublisher>;
  let useCase:    ApproveRegistrationUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    userClient = makeUserClient();
    outbox     = makeOutbox();
    useCase    = new ApproveRegistrationUseCase(repo, userClient, outbox);
  });

  it('approves registration and publishes registration.approved event', async () => {
    repo.findById.mockResolvedValue(makeReg('pending'));
    userClient.approveUser.mockResolvedValue(undefined);
    repo.update.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    const result = await useCase.execute('uid-1', 'req-1');

    expect(result.state).toBe('approved');
    expect(userClient.approveUser).toHaveBeenCalledWith('uid-1');
    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'registration.approved' }),
    );
  });

  it('throws 404 ENROLLMENT_NOT_FOUND when registration does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('uid-1', 'req-1')).rejects.toMatchObject({
      status:    404,
      errorCode: 'ENROLLMENT_NOT_FOUND',
    });
  });

  it('throws 422 USER_NOT_FOUND when userClient returns 404', async () => {
    repo.findById.mockResolvedValue(makeReg('pending'));
    const err = Object.assign(new Error('Not found'), { response: { status: 404 } });
    userClient.approveUser.mockRejectedValue(err);

    await expect(useCase.execute('uid-1', 'req-1')).rejects.toMatchObject({
      status:    422,
      errorCode: 'USER_NOT_FOUND',
    });
  });

  it('throws 409 INVALID_STATE when registration is already approved', async () => {
    repo.findById.mockResolvedValue(makeReg('approved'));
    await expect(useCase.execute('uid-1', 'req-1')).rejects.toMatchObject({
      status:    409,
      errorCode: 'INVALID_STATE',
    });
  });
});
