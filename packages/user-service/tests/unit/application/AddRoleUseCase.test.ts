import { AddRoleUseCase }       from '../../../src/application/use-cases/AddRoleUseCase';
import { IUserRepository }      from '../../../src/domain/repositories/IUserRepository';
import { FirebaseAuthClient }   from '../../../src/infrastructure/clients/FirebaseAuthClient';
import { User }                 from '../../../src/domain/entities/User';

const makeRepo = (): jest.Mocked<IUserRepository> => ({
  findById:  jest.fn(),
  findByEmail: jest.fn(),
  findAll:   jest.fn(),
  create:    jest.fn(),
  update:    jest.fn(),
  softDelete: jest.fn(), hardDelete: jest.fn(),
});

const makeAuth = (): jest.Mocked<FirebaseAuthClient> =>
  ({ addRoleToUser: jest.fn(), removeRoleFromUser: jest.fn() } as unknown as jest.Mocked<FirebaseAuthClient>);

const makeUser = (roles: string[] = ['member']): User =>
  new User({
    uid: 'uid-1', email: 'u@test.com', firstName: 'A', lastName: 'B',
    role: 'member', roles: roles as never, status: 'approved',
    profilePhotoUrl: null, createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null,
  });

describe('AddRoleUseCase', () => {
  let repo:    jest.Mocked<IUserRepository>;
  let auth:    jest.Mocked<FirebaseAuthClient>;
  let useCase: AddRoleUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    auth    = makeAuth();
    useCase = new AddRoleUseCase(repo, auth);
  });

  it('adds role to user, persists, and updates Firebase claims', async () => {
    repo.findById.mockResolvedValue(makeUser(['member']));
    repo.update.mockResolvedValue(undefined);
    auth.addRoleToUser.mockResolvedValue(undefined);

    await useCase.execute('uid-1', 'student');

    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({
      roles: expect.arrayContaining(['member', 'student']),
    }));
    expect(auth.addRoleToUser).toHaveBeenCalledWith('uid-1', 'student');
  });

  it('is idempotent â€” no write when user already has the role', async () => {
    repo.findById.mockResolvedValue(makeUser(['member', 'student']));

    await useCase.execute('uid-1', 'student');

    expect(repo.update).not.toHaveBeenCalled();
    expect(auth.addRoleToUser).not.toHaveBeenCalled();
  });

  it('throws 404 USER_NOT_FOUND when user does not exist', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(useCase.execute('uid-ghost', 'student')).rejects.toMatchObject({
      status: 404, errorCode: 'USER_NOT_FOUND',
    });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('throws 400 INVALID_ROLE for an unrecognised role string', async () => {
    await expect(useCase.execute('uid-1', 'supervillain')).rejects.toMatchObject({
      status: 400, errorCode: 'INVALID_ROLE',
    });
    expect(repo.findById).not.toHaveBeenCalled();
  });

  it('can add leader role to a member', async () => {
    repo.findById.mockResolvedValue(makeUser(['member']));
    repo.update.mockResolvedValue(undefined);
    auth.addRoleToUser.mockResolvedValue(undefined);

    await useCase.execute('uid-1', 'leader');

    expect(auth.addRoleToUser).toHaveBeenCalledWith('uid-1', 'leader');
  });

  it('can add g12 role to a leader', async () => {
    repo.findById.mockResolvedValue(makeUser(['member', 'leader']));
    repo.update.mockResolvedValue(undefined);
    auth.addRoleToUser.mockResolvedValue(undefined);

    await useCase.execute('uid-1', 'g12');

    expect(auth.addRoleToUser).toHaveBeenCalledWith('uid-1', 'g12');
  });
});

