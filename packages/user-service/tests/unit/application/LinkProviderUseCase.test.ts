import { LinkProviderUseCase }    from '../../../src/application/use-cases/LinkProviderUseCase';
import { IUserRepository }        from '../../../src/domain/repositories/IUserRepository';
import { AuthServiceClient }      from '../../../src/infrastructure/clients/AuthServiceClient';
import { User }                   from '../../../src/domain/entities/User';

const makeRepo = (): jest.Mocked<IUserRepository> => ({
  findById: jest.fn(), findByEmail: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), softDelete: jest.fn(),
});

const makeAuthSvcClient = (): jest.Mocked<AuthServiceClient> =>
  ({ verifyFederatedToken: jest.fn() } as unknown as jest.Mocked<AuthServiceClient>);

const makeUser = (email = 'user@example.com', providers = ['password']): User =>
  new User({
    uid: 'uid-1', email, firstName: 'A', lastName: 'B',
    role: 'member', roles: ['member'], status: 'approved',
    profilePhotoUrl: null, providers,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', deletedAt: null,
  });

describe('LinkProviderUseCase', () => {
  let repo:      jest.Mocked<IUserRepository>;
  let authSvc:   jest.Mocked<AuthServiceClient>;
  let useCase:   LinkProviderUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    authSvc = makeAuthSvcClient();
    useCase = new LinkProviderUseCase(repo, authSvc);
  });

  it('links google.com provider to user', async () => {
    repo.findById.mockResolvedValue(makeUser('user@example.com', ['password']));
    authSvc.verifyFederatedToken.mockResolvedValue({
      email: 'user@example.com', displayName: 'User', providerUid: 'g-uid-1', providerId: 'google.com',
    });
    repo.update.mockResolvedValue(undefined);

    const result = await useCase.execute('uid-1', 'google', 'valid-token');

    expect(result).toContain('google.com');
    expect(result).toContain('password');
    expect(repo.update).toHaveBeenCalled();
  });

  it('is idempotent — no update when provider already linked', async () => {
    repo.findById.mockResolvedValue(makeUser('user@example.com', ['password', 'google.com']));
    authSvc.verifyFederatedToken.mockResolvedValue({
      email: 'user@example.com', displayName: 'User', providerUid: 'g-uid-1', providerId: 'google.com',
    });

    const result = await useCase.execute('uid-1', 'google', 'valid-token');

    expect(result).toContain('google.com');
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('throws 409 EMAIL_MISMATCH when token email differs from account email', async () => {
    repo.findById.mockResolvedValue(makeUser('user@example.com'));
    authSvc.verifyFederatedToken.mockResolvedValue({
      email: 'different@gmail.com', displayName: 'Other', providerUid: 'g-uid-2', providerId: 'google.com',
    });

    await expect(useCase.execute('uid-1', 'google', 'token')).rejects.toMatchObject({
      status: 409, errorCode: 'EMAIL_MISMATCH',
    });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('throws 404 when user not found', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('uid-ghost', 'google', 'token')).rejects.toMatchObject({
      status: 404, errorCode: 'USER_NOT_FOUND',
    });
  });
});
