import { SuspendMasterUseCase } from '../../../src/application/use-cases/SuspendMasterUseCase';
import { IUserRepository }      from '../../../src/domain/repositories/IUserRepository';
import { FirebaseAuthClient }   from '../../../src/infrastructure/clients/FirebaseAuthClient';
import { User }                 from '../../../src/domain/entities/User';

const makeUser = (overrides = {}): User =>
  new User({
    uid: 'master-uid', email: 'master@example.com', firstName: 'M',
    lastName: 'U', role: 'member', roles: ['member', 'master'], status: 'approved',
    profilePhotoUrl: null, createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null, ...overrides,
  });

const makeRepo = (): jest.Mocked<IUserRepository> => ({
  findById:        jest.fn(),
  findByEmail:     jest.fn(),
  findAll:         jest.fn(),
  create:          jest.fn(),
  update:          jest.fn(),
  softDelete:      jest.fn(),
  hardDelete:      jest.fn(),
  atomicAddRole:   jest.fn(),
  atomicRemoveRole: jest.fn(),
});

const makeAuthClient = (): jest.Mocked<FirebaseAuthClient> =>
  ({ disableUser: jest.fn() } as unknown as jest.Mocked<FirebaseAuthClient>);

describe('SuspendMasterUseCase', () => {
  let repo:       jest.Mocked<IUserRepository>;
  let authClient: jest.Mocked<FirebaseAuthClient>;
  let useCase:    SuspendMasterUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    authClient = makeAuthClient();
    useCase    = new SuspendMasterUseCase(repo, authClient);
  });

  it('suspends the master and disables Firebase Auth account', async () => {
    repo.findById.mockResolvedValue(makeUser());
    repo.update.mockResolvedValue(undefined);
    authClient.disableUser.mockResolvedValue(undefined);

    const result = await useCase.execute('master-uid');

    expect(result.status).toBe('suspended');
    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'suspended' }));
    expect(authClient.disableUser).toHaveBeenCalledWith('master-uid');
  });

  it('throws 404 USER_NOT_FOUND when user does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('ghost-uid')).rejects.toMatchObject({
      status:    404,
      errorCode: 'USER_NOT_FOUND',
    });
    expect(authClient.disableUser).not.toHaveBeenCalled();
  });

  it('throws 404 USER_NOT_FOUND when user does not have the master role', async () => {
    repo.findById.mockResolvedValue(makeUser({ roles: ['member', 'student'] }));

    await expect(useCase.execute('master-uid')).rejects.toMatchObject({
      status:    404,
      errorCode: 'USER_NOT_FOUND',
    });
    expect(authClient.disableUser).not.toHaveBeenCalled();
  });

  it('throws 409 ALREADY_SUSPENDED when master is already suspended', async () => {
    repo.findById.mockResolvedValue(makeUser({ status: 'suspended' }));

    await expect(useCase.execute('master-uid')).rejects.toMatchObject({
      status:    409,
      errorCode: 'ALREADY_SUSPENDED',
    });
    expect(repo.update).not.toHaveBeenCalled();
  });
});
