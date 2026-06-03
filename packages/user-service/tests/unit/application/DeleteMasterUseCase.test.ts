import { DeleteMasterUseCase } from '../../../src/application/use-cases/DeleteMasterUseCase';
import { IUserRepository }     from '../../../src/domain/repositories/IUserRepository';
import { FirebaseAuthClient }  from '../../../src/infrastructure/clients/FirebaseAuthClient';
import { User }                from '../../../src/domain/entities/User';

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
  ({ deleteUser: jest.fn() } as unknown as jest.Mocked<FirebaseAuthClient>);

describe('DeleteMasterUseCase', () => {
  let repo:       jest.Mocked<IUserRepository>;
  let authClient: jest.Mocked<FirebaseAuthClient>;
  let useCase:    DeleteMasterUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    authClient = makeAuthClient();
    useCase    = new DeleteMasterUseCase(repo, authClient);
  });

  it('hard-deletes master from Firestore and Firebase Auth', async () => {
    repo.findById.mockResolvedValue(makeUser());
    repo.hardDelete.mockResolvedValue(undefined);
    authClient.deleteUser.mockResolvedValue(undefined);

    await useCase.execute('master-uid');

    expect(repo.hardDelete).toHaveBeenCalledWith('master-uid');
    expect(authClient.deleteUser).toHaveBeenCalledWith('master-uid');
  });

  it('throws 404 USER_NOT_FOUND when user does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('ghost-uid')).rejects.toMatchObject({
      status:    404,
      errorCode: 'USER_NOT_FOUND',
    });
    expect(repo.hardDelete).not.toHaveBeenCalled();
  });

  it('throws 404 USER_NOT_FOUND when user does not have the master role', async () => {
    repo.findById.mockResolvedValue(makeUser({ roles: ['member', 'admin'] }));

    await expect(useCase.execute('master-uid')).rejects.toMatchObject({
      status:    404,
      errorCode: 'USER_NOT_FOUND',
    });
    expect(repo.hardDelete).not.toHaveBeenCalled();
  });

  it('propagates errors from Firebase Auth deleteUser', async () => {
    repo.findById.mockResolvedValue(makeUser());
    repo.hardDelete.mockResolvedValue(undefined);
    authClient.deleteUser.mockRejectedValue(new Error('Firebase error'));

    await expect(useCase.execute('master-uid')).rejects.toThrow('Firebase error');
  });
});
