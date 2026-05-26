import { DeregisterFcmTokenUseCase } from '../../../src/application/use-cases/DeregisterFcmTokenUseCase';
import { IUserRepository }           from '../../../src/domain/repositories/IUserRepository';
import { User }                      from '../../../src/domain/entities/User';

const makeRepo = (): jest.Mocked<IUserRepository> => ({
  findById: jest.fn(), findByEmail: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), softDelete: jest.fn(), hardDelete: jest.fn(),
});

const makeUser = (fcmTokens: string[] = ['token-abc', 'token-xyz']): User =>
  new User({
    uid: 'uid-1', email: 'u@test.com', firstName: 'A', lastName: 'B',
    role: 'member', roles: ['member'], status: 'approved',
    profilePhotoUrl: null, fcmTokens,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null,
  });

describe('DeregisterFcmTokenUseCase', () => {
  let repo:    jest.Mocked<IUserRepository>;
  let useCase: DeregisterFcmTokenUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new DeregisterFcmTokenUseCase(repo);
  });

  it('removes the token and persists', async () => {
    repo.findById.mockResolvedValue(makeUser(['token-abc', 'token-xyz']));
    repo.update.mockResolvedValue(undefined);

    await useCase.execute('uid-1', 'token-abc');

    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({
      fcmTokens: ['token-xyz'],
    }));
  });

  it('is idempotent â€” no update when token not present', async () => {
    repo.findById.mockResolvedValue(makeUser(['token-xyz']));

    await useCase.execute('uid-1', 'token-not-found');

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('throws 404 USER_NOT_FOUND when user does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('uid-ghost', 'token-abc')).rejects.toMatchObject({
      status: 404, errorCode: 'USER_NOT_FOUND',
    });
    expect(repo.update).not.toHaveBeenCalled();
  });
});

