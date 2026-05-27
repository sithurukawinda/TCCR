import { CheckEmailExistsUseCase } from '../../../src/application/use-cases/CheckEmailExistsUseCase';
import { IUserRepository }         from '../../../src/domain/repositories/IUserRepository';
import { User }                    from '../../../src/domain/entities/User';

const makeUser = (): User =>
  new User({
    uid: 'uid-1', email: 'u@example.com', firstName: 'A', lastName: 'B',
    role: 'student', roles: ['student'], status: 'approved',
    profilePhotoUrl: null, createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null,
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

describe('CheckEmailExistsUseCase', () => {
  let repo:    jest.Mocked<IUserRepository>;
  let useCase: CheckEmailExistsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new CheckEmailExistsUseCase(repo);
  });

  it('returns { exists: true } when email is registered', async () => {
    repo.findByEmail.mockResolvedValue(makeUser());
    const result = await useCase.execute('u@example.com');
    expect(result).toEqual({ exists: true });
  });

  it('returns { exists: false } when email is not registered', async () => {
    repo.findByEmail.mockResolvedValue(null);
    const result = await useCase.execute('unknown@example.com');
    expect(result).toEqual({ exists: false });
  });

  it('calls findByEmail with the provided email', async () => {
    repo.findByEmail.mockResolvedValue(null);
    await useCase.execute('test@example.com');
    expect(repo.findByEmail).toHaveBeenCalledWith('test@example.com');
  });
});
