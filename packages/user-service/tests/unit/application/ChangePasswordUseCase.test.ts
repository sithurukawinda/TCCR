import { ChangePasswordUseCase } from '../../../src/application/use-cases/ChangePasswordUseCase';
import { IUserRepository }       from '../../../src/domain/repositories/IUserRepository';
import { FirebaseAuthClient }    from '../../../src/infrastructure/clients/FirebaseAuthClient';
import { User }                  from '../../../src/domain/entities/User';

const makeUser = (overrides = {}): User =>
  new User({
    uid: 'uid-1', email: 'u@example.com', firstName: 'A', lastName: 'B',
    role: 'student', roles: ['student'], status: 'approved',
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

describe('ChangePasswordUseCase', () => {
  let repo:       jest.Mocked<IUserRepository>;
  let authClient: jest.Mocked<FirebaseAuthClient>;
  let useCase:    ChangePasswordUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    authClient = makeAuthClient();
    useCase    = new ChangePasswordUseCase(repo, authClient);
  });

  it('verifies current password and updates to new password', async () => {
    repo.findById.mockResolvedValue(makeUser());
    authClient.verifyPassword.mockResolvedValue(undefined);
    authClient.updatePassword.mockResolvedValue(undefined);

    await useCase.execute({ uid: 'uid-1', currentPassword: 'OldPass@1', newPassword: 'NewPass@1' });

    expect(authClient.verifyPassword).toHaveBeenCalledWith('u@example.com', 'OldPass@1');
    expect(authClient.updatePassword).toHaveBeenCalledWith('uid-1', 'NewPass@1');
  });

  it('throws 404 USER_NOT_FOUND when user does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ uid: 'uid-1', currentPassword: 'old', newPassword: 'new' })).rejects.toMatchObject({
      status:    404,
      errorCode: 'USER_NOT_FOUND',
    });
    expect(authClient.verifyPassword).not.toHaveBeenCalled();
  });

  it('propagates 401 from verifyPassword when current password is wrong', async () => {
    repo.findById.mockResolvedValue(makeUser());
    authClient.verifyPassword.mockRejectedValue({ status: 401, errorCode: 'WRONG_PASSWORD' });

    await expect(useCase.execute({ uid: 'uid-1', currentPassword: 'wrong', newPassword: 'new' })).rejects.toMatchObject({
      errorCode: 'WRONG_PASSWORD',
    });
    expect(authClient.updatePassword).not.toHaveBeenCalled();
  });
});
