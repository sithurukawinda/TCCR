import { RemoveRoleUseCase }     from '../../../src/application/use-cases/RemoveRoleUseCase';
import { IUserRepository }       from '../../../src/domain/repositories/IUserRepository';
import { FirebaseAuthClient }    from '../../../src/infrastructure/clients/FirebaseAuthClient';
import { User }                  from '../../../src/domain/entities/User';

const makeRepo = (): jest.Mocked<IUserRepository> => ({
  findById:  jest.fn(),
  findByEmail: jest.fn(),
  findAll:   jest.fn(),
  create:    jest.fn(),
  update:    jest.fn(),
  softDelete: jest.fn(),
});

const makeAuth = (): jest.Mocked<FirebaseAuthClient> =>
  ({ addRoleToUser: jest.fn(), removeRoleFromUser: jest.fn() } as unknown as jest.Mocked<FirebaseAuthClient>);

const makeUser = (roles: string[] = ['member', 'student']): User =>
  new User({
    uid: 'uid-1', email: 'u@test.com', firstName: 'A', lastName: 'B',
    role: 'student', roles: roles as never, status: 'approved',
    profilePhotoUrl: null, createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null,
  });

describe('RemoveRoleUseCase', () => {
  let repo:    jest.Mocked<IUserRepository>;
  let auth:    jest.Mocked<FirebaseAuthClient>;
  let useCase: RemoveRoleUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    auth    = makeAuth();
    useCase = new RemoveRoleUseCase(repo, auth);
  });

  it('removes role from user, persists, and updates Firebase claims', async () => {
    repo.findById.mockResolvedValue(makeUser(['member', 'student']));
    repo.update.mockResolvedValue(undefined);
    auth.removeRoleFromUser.mockResolvedValue(undefined);

    await useCase.execute('uid-1', 'student');

    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({
      roles: expect.not.arrayContaining(['student']),
    }));
    expect(auth.removeRoleFromUser).toHaveBeenCalledWith('uid-1', 'student');
  });

  it('is idempotent — no write when user does not have the role', async () => {
    repo.findById.mockResolvedValue(makeUser(['member']));

    await useCase.execute('uid-1', 'leader');

    expect(repo.update).not.toHaveBeenCalled();
    expect(auth.removeRoleFromUser).not.toHaveBeenCalled();
  });

  it('throws 400 INVALID_ROLE when trying to remove member role', async () => {
    await expect(useCase.execute('uid-1', 'member')).rejects.toMatchObject({
      status: 400, errorCode: 'INVALID_ROLE',
    });
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('throws 400 INVALID_ROLE for an unrecognised role string', async () => {
    await expect(useCase.execute('uid-1', 'supervillain')).rejects.toMatchObject({
      status: 400, errorCode: 'INVALID_ROLE',
    });
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('throws 404 USER_NOT_FOUND when user does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('uid-ghost', 'student')).rejects.toMatchObject({
      status: 404, errorCode: 'USER_NOT_FOUND',
    });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('can remove leader and g12 roles from a user with multiple roles', async () => {
    repo.findById.mockResolvedValue(makeUser(['member', 'student', 'leader', 'g12']));
    repo.update.mockResolvedValue(undefined);
    auth.removeRoleFromUser.mockResolvedValue(undefined);

    await useCase.execute('uid-1', 'g12');

    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({
      roles: expect.not.arrayContaining(['g12']),
    }));
  });
});
