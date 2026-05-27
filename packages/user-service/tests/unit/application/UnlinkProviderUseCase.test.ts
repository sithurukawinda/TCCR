import { UnlinkProviderUseCase } from '../../../src/application/use-cases/UnlinkProviderUseCase';
import { IUserRepository }       from '../../../src/domain/repositories/IUserRepository';
import { User }                  from '../../../src/domain/entities/User';

const makeRepo = (): jest.Mocked<IUserRepository> => ({
  findById: jest.fn(), findByEmail: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), softDelete: jest.fn(), hardDelete: jest.fn(),
});

const makeUser = (providers: string[]): User =>
  new User({
    uid: 'uid-1', email: 'user@example.com', firstName: 'A', lastName: 'B',
    role: 'member', roles: ['member'], status: 'approved',
    profilePhotoUrl: null, providers,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', deletedAt: null,
  });

describe('UnlinkProviderUseCase', () => {
  let repo:    jest.Mocked<IUserRepository>;
  let useCase: UnlinkProviderUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new UnlinkProviderUseCase(repo);
  });

  it('removes google.com from providers', async () => {
    repo.findById.mockResolvedValue(makeUser(['password', 'google.com']));
    repo.update.mockResolvedValue(undefined);

    const result = await useCase.execute('uid-1', 'google');

    expect(result).not.toContain('google.com');
    expect(result).toContain('password');
    expect(repo.update).toHaveBeenCalled();
  });

  it('removes apple.com from providers', async () => {
    repo.findById.mockResolvedValue(makeUser(['password', 'apple.com']));
    repo.update.mockResolvedValue(undefined);

    const result = await useCase.execute('uid-1', 'apple');

    expect(result).not.toContain('apple.com');
  });

  it('throws 409 INVALID_STATE when it is the only sign-in method', async () => {
    repo.findById.mockResolvedValue(makeUser(['google.com']));

    await expect(useCase.execute('uid-1', 'google')).rejects.toMatchObject({
      status: 409, errorCode: 'INVALID_STATE',
    });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('throws 400 for unknown provider name', async () => {
    await expect(useCase.execute('uid-1', 'facebook')).rejects.toMatchObject({
      status: 400, errorCode: 'VALIDATION_ERROR',
    });
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('throws 404 when user not found', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('uid-ghost', 'google')).rejects.toMatchObject({
      status: 404, errorCode: 'USER_NOT_FOUND',
    });
  });
});

