import { RegisterFcmTokenUseCase } from '../../../src/application/use-cases/RegisterFcmTokenUseCase';
import { IUserRepository }         from '../../../src/domain/repositories/IUserRepository';
import { User }                    from '../../../src/domain/entities/User';

const makeRepo = (): jest.Mocked<IUserRepository> => ({
  findById:  jest.fn(),
  findByEmail: jest.fn(),
  findAll:   jest.fn(),
  create:    jest.fn(),
  update:    jest.fn(),
  softDelete: jest.fn(),
});

const makeUser = (fcmTokens: string[] = []): User =>
  new User({
    uid: 'uid-1', email: 'u@test.com', firstName: 'A', lastName: 'B',
    role: 'member', roles: ['member'], status: 'approved',
    profilePhotoUrl: null, fcmTokens,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null,
  });

describe('RegisterFcmTokenUseCase', () => {
  let repo:    jest.Mocked<IUserRepository>;
  let useCase: RegisterFcmTokenUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new RegisterFcmTokenUseCase(repo);
  });

  it('appends FCM token to user and persists', async () => {
    repo.findById.mockResolvedValue(makeUser([]));
    repo.update.mockResolvedValue(undefined);

    await useCase.execute('uid-1', 'fcm-token-abc');

    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({
      fcmTokens: expect.arrayContaining(['fcm-token-abc']),
    }));
  });

  it('is idempotent — no update when token already registered', async () => {
    repo.findById.mockResolvedValue(makeUser(['fcm-token-abc']));

    await useCase.execute('uid-1', 'fcm-token-abc');

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('appends new token without removing existing ones', async () => {
    repo.findById.mockResolvedValue(makeUser(['old-token']));
    repo.update.mockResolvedValue(undefined);

    await useCase.execute('uid-1', 'new-token');

    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({
      fcmTokens: expect.arrayContaining(['old-token', 'new-token']),
    }));
  });

  it('throws 404 USER_NOT_FOUND when user does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('uid-ghost', 'fcm-token')).rejects.toMatchObject({
      status: 404, errorCode: 'USER_NOT_FOUND',
    });
    expect(repo.update).not.toHaveBeenCalled();
  });
});
