import { UpdateProfileUseCase } from '../../../src/application/use-cases/UpdateProfileUseCase';
import { IUserRepository }      from '../../../src/domain/repositories/IUserRepository';
import { User }                 from '../../../src/domain/entities/User';

const makeUser = (overrides = {}): User =>
  new User({
    uid: 'uid-1', email: 'u@example.com', firstName: 'Alice', lastName: 'Smith',
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

describe('UpdateProfileUseCase', () => {
  let repo:    jest.Mocked<IUserRepository>;
  let useCase: UpdateProfileUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new UpdateProfileUseCase(repo);
  });

  it('updates profile fields and persists the user', async () => {
    repo.findById.mockResolvedValue(makeUser());
    repo.update.mockResolvedValue(undefined);

    const result = await useCase.execute({ uid: 'uid-1', firstName: 'Bob', lastName: 'Jones' });

    expect(result.firstName).toBe('Bob');
    expect(result.lastName).toBe('Jones');
    expect(repo.update).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Bob', lastName: 'Jones' }));
  });

  it('throws 404 USER_NOT_FOUND when user does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ uid: 'uid-1' })).rejects.toMatchObject({
      status:    404,
      errorCode: 'USER_NOT_FOUND',
    });
  });

  it('updates profilePhotoUrl to null when explicitly passed null', async () => {
    repo.findById.mockResolvedValue(makeUser({ profilePhotoUrl: 'http://old.jpg' }));
    repo.update.mockResolvedValue(undefined);

    const result = await useCase.execute({ uid: 'uid-1', profilePhotoUrl: null });

    expect(result.profilePhotoUrl).toBeNull();
  });

  it('does not change unspecified fields', async () => {
    repo.findById.mockResolvedValue(makeUser());
    repo.update.mockResolvedValue(undefined);

    const result = await useCase.execute({ uid: 'uid-1', firstName: 'NewName' });

    expect(result.lastName).toBe('Smith');
    expect(result.email).toBe('u@example.com');
  });
});
