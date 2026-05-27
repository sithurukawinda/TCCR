import { UpdateNotificationPreferencesUseCase } from '../../../src/application/use-cases/UpdateNotificationPreferencesUseCase';
import { IUserRepository }                       from '../../../src/domain/repositories/IUserRepository';
import { User }                                  from '../../../src/domain/entities/User';

const makeRepo = (): jest.Mocked<IUserRepository> => ({
  findById: jest.fn(), findByEmail: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), softDelete: jest.fn(), hardDelete: jest.fn(),
});

const makeUser = (): User =>
  new User({
    uid: 'uid-1', email: 'u@test.com', firstName: 'A', lastName: 'B',
    role: 'member', roles: ['member'], status: 'approved',
    profilePhotoUrl: null, notificationPreferences: { email: true, push: true },
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null,
  });

describe('UpdateNotificationPreferencesUseCase', () => {
  let repo:    jest.Mocked<IUserRepository>;
  let useCase: UpdateNotificationPreferencesUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new UpdateNotificationPreferencesUseCase(repo);
  });

  it('disables push notifications and persists', async () => {
    repo.findById.mockResolvedValue(makeUser());
    repo.update.mockResolvedValue(undefined);

    const result = await useCase.execute('uid-1', { push: false });

    expect(result).toEqual({ email: true, push: false });
    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({
      notificationPreferences: { email: true, push: false },
    }));
  });

  it('disables email notifications, retains push preference', async () => {
    repo.findById.mockResolvedValue(makeUser());
    repo.update.mockResolvedValue(undefined);

    const result = await useCase.execute('uid-1', { email: false });

    expect(result).toEqual({ email: false, push: true });
  });

  it('updates both channels at once', async () => {
    repo.findById.mockResolvedValue(makeUser());
    repo.update.mockResolvedValue(undefined);

    const result = await useCase.execute('uid-1', { email: false, push: false });

    expect(result).toEqual({ email: false, push: false });
  });

  it('re-enabling a channel sets it to true', async () => {
    const user = makeUser();
    user.notificationPreferences = { email: false, push: false };
    repo.findById.mockResolvedValue(user);
    repo.update.mockResolvedValue(undefined);

    const result = await useCase.execute('uid-1', { email: true });

    expect(result.email).toBe(true);
    expect(result.push).toBe(false);
  });

  it('throws 404 USER_NOT_FOUND when user does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('uid-ghost', { push: false })).rejects.toMatchObject({
      status: 404, errorCode: 'USER_NOT_FOUND',
    });
    expect(repo.update).not.toHaveBeenCalled();
  });
});

