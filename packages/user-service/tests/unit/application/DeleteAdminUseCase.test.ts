import { DeleteAdminUseCase }  from '../../../src/application/use-cases/DeleteAdminUseCase';
import { IUserRepository }    from '../../../src/domain/repositories/IUserRepository';
import { FirebaseAuthClient } from '../../../src/infrastructure/clients/FirebaseAuthClient';
import { User }               from '../../../src/domain/entities/User';

const makeUser = (overrides = {}): User =>
  new User({
    uid: 'uid-1', email: 'admin@example.com', firstName: 'A', lastName: 'B',
    role: 'admin', roles: ['admin'], status: 'approved',
    profilePhotoUrl: null, createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null, ...overrides,
  });

const makeRepo = (): jest.Mocked<IUserRepository> => ({
  findById:    jest.fn(),
  findByEmail: jest.fn(),
  findAll:     jest.fn(),
  create:      jest.fn(),
  update:      jest.fn(),
  softDelete:  jest.fn(),
  hardDelete:  jest.fn(),
});

const makeAuthClient = (): jest.Mocked<FirebaseAuthClient> => ({
  createUser:      jest.fn(),
  setCustomClaims: jest.fn(),
  disableUser:     jest.fn(),
  enableUser:      jest.fn(),
  updatePassword:  jest.fn(),
  deleteUser:      jest.fn(),
  verifyPassword:  jest.fn(),
} as unknown as jest.Mocked<FirebaseAuthClient>);

describe('DeleteAdminUseCase', () => {
  let repo:       jest.Mocked<IUserRepository>;
  let authClient: jest.Mocked<FirebaseAuthClient>;
  let useCase:    DeleteAdminUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    authClient = makeAuthClient();
    useCase    = new DeleteAdminUseCase(repo, authClient);
  });

  it('soft-deletes admin and disables Firebase user', async () => {
    repo.findById.mockResolvedValue(makeUser());
    repo.softDelete.mockResolvedValue(undefined);
    authClient.disableUser.mockResolvedValue(undefined);

    await useCase.execute('uid-1');

    expect(repo.softDelete).toHaveBeenCalledWith('uid-1');
    expect(authClient.disableUser).toHaveBeenCalledWith('uid-1');
  });

  it('throws 404 USER_NOT_FOUND when user does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('uid-1')).rejects.toMatchObject({
      status:    404,
      errorCode: 'USER_NOT_FOUND',
    });
  });

  it('throws 404 USER_NOT_FOUND when user is not an admin', async () => {
    repo.findById.mockResolvedValue(makeUser({ role: 'student' }));
    await expect(useCase.execute('uid-1')).rejects.toMatchObject({
      status:    404,
      errorCode: 'USER_NOT_FOUND',
    });
    expect(repo.softDelete).not.toHaveBeenCalled();
  });

  it('propagates errors from disableUser', async () => {
    repo.findById.mockResolvedValue(makeUser());
    repo.softDelete.mockResolvedValue(undefined);
    authClient.disableUser.mockRejectedValue(new Error('Firebase error'));

    await expect(useCase.execute('uid-1')).rejects.toThrow('Firebase error');
  });
});
