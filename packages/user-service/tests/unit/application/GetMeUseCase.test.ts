import { GetMeUseCase }       from '../../../src/application/use-cases/GetMeUseCase';
import { IUserRepository }    from '../../../src/domain/repositories/IUserRepository';
import { User }               from '../../../src/domain/entities/User';

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

describe('GetMeUseCase', () => {
  let repo:    jest.Mocked<IUserRepository>;
  let useCase: GetMeUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new GetMeUseCase(repo);
  });

  it('returns the user when found', async () => {
    repo.findById.mockResolvedValue(makeUser());
    const user = await useCase.execute('uid-1');
    expect(user.uid).toBe('uid-1');
    expect(repo.findById).toHaveBeenCalledWith('uid-1');
  });

  it('throws 404 USER_NOT_FOUND when user does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('uid-1')).rejects.toMatchObject({
      status:    404,
      errorCode: 'USER_NOT_FOUND',
    });
  });

  it('propagates repo errors', async () => {
    repo.findById.mockRejectedValue(new Error('Firestore error'));
    await expect(useCase.execute('uid-1')).rejects.toThrow('Firestore error');
  });
});
