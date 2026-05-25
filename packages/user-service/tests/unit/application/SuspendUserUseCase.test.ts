import { SuspendUserUseCase }  from '../../../src/application/use-cases/SuspendUserUseCase';
import { IUserRepository }     from '../../../src/domain/repositories/IUserRepository';
import { FirebaseAuthClient }  from '../../../src/infrastructure/clients/FirebaseAuthClient';
import { OutboxEventPublisher } from '@shared/events';
import { User }                from '../../../src/domain/entities/User';

const makeUser = (overrides = {}): User =>
  new User({
    uid: 'uid-1', email: 'student@example.com', firstName: 'Viruli',
    lastName: 'W', role: 'student', roles: ['student'], status: 'approved',
    profilePhotoUrl: null, createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z', deletedAt: null, ...overrides,
  });

const makeRepo = (): jest.Mocked<IUserRepository> => ({
  findById:    jest.fn(),
  findByEmail: jest.fn(),
  findAll:     jest.fn(),
  create:      jest.fn(),
  update:      jest.fn(),
  softDelete:  jest.fn(),
});

const makeAuthClient = (): jest.Mocked<FirebaseAuthClient> =>
  ({ disableUser: jest.fn(), enableUser: jest.fn() } as unknown as jest.Mocked<FirebaseAuthClient>);

const makeOutbox = (): jest.Mocked<OutboxEventPublisher> =>
  ({ publishWithBatch: jest.fn() } as unknown as jest.Mocked<OutboxEventPublisher>);

describe('SuspendUserUseCase', () => {
  let repo:       jest.Mocked<IUserRepository>;
  let authClient: jest.Mocked<FirebaseAuthClient>;
  let outbox:     jest.Mocked<OutboxEventPublisher>;
  let useCase:    SuspendUserUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    authClient = makeAuthClient();
    outbox     = makeOutbox();
    useCase    = new SuspendUserUseCase(repo, authClient, outbox);
  });

  it('suspends a student and disables Firebase Auth account', async () => {
    repo.findById.mockResolvedValue(makeUser());
    repo.update.mockResolvedValue(undefined);
    authClient.disableUser.mockResolvedValue(undefined);

    const user = await useCase.execute('uid-1', 'req-1');

    expect(user.status).toBe('suspended');
    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'suspended' }));
    expect(authClient.disableUser).toHaveBeenCalledWith('uid-1');
  });

  it('does NOT publish admin.suspended event for a student', async () => {
    repo.findById.mockResolvedValue(makeUser({ role: 'student' }));
    repo.update.mockResolvedValue(undefined);
    authClient.disableUser.mockResolvedValue(undefined);

    await useCase.execute('uid-1', 'req-1');

    expect(outbox.publishWithBatch).not.toHaveBeenCalled();
  });

  it('publishes admin.suspended event when suspending an admin', async () => {
    repo.findById.mockResolvedValue(makeUser({ role: 'admin' }));
    repo.update.mockResolvedValue(undefined);
    authClient.disableUser.mockResolvedValue(undefined);
    outbox.publishWithBatch.mockResolvedValue(undefined);

    await useCase.execute('uid-1', 'req-1');

    expect(outbox.publishWithBatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'admin.suspended' }),
    );
  });

  it('throws 404 USER_NOT_FOUND when user does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('uid-1', 'req-1')).rejects.toMatchObject({
      errorCode: 'USER_NOT_FOUND',
      status:    404,
    });
    expect(authClient.disableUser).not.toHaveBeenCalled();
  });
});
