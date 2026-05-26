import { ApproveUserUseCase }  from '../../../src/application/use-cases/ApproveUserUseCase';
import { IUserRepository }    from '../../../src/domain/repositories/IUserRepository';
import { FirebaseAuthClient } from '../../../src/infrastructure/clients/FirebaseAuthClient';
import { User }               from '../../../src/domain/entities/User';

const makeUser = (overrides = {}): User =>
  new User({
    uid: 'uid-1', email: 'u@example.com', firstName: 'A', lastName: 'B',
    role: 'student', roles: ['student'], status: 'pending_approval',
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

describe('ApproveUserUseCase', () => {
  let repo:       jest.Mocked<IUserRepository>;
  let authClient: jest.Mocked<FirebaseAuthClient>;
  let useCase:    ApproveUserUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    authClient = makeAuthClient();
    useCase    = new ApproveUserUseCase(repo, authClient);
  });

  it('approves user and enables Firebase account', async () => {
    repo.findById.mockResolvedValue(makeUser());
    repo.update.mockResolvedValue(undefined);
    authClient.enableUser.mockResolvedValue(undefined);

    await useCase.execute('uid-1');

    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' }));
    expect(authClient.enableUser).toHaveBeenCalledWith('uid-1');
  });

  it('throws 404 USER_NOT_FOUND when user does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('uid-1')).rejects.toMatchObject({
      status:    404,
      errorCode: 'USER_NOT_FOUND',
    });
    expect(authClient.enableUser).not.toHaveBeenCalled();
  });

  it('propagates errors from enabling Firebase user', async () => {
    repo.findById.mockResolvedValue(makeUser());
    repo.update.mockResolvedValue(undefined);
    authClient.enableUser.mockRejectedValue(new Error('Firebase error'));

    await expect(useCase.execute('uid-1')).rejects.toThrow('Firebase error');
  });
});
