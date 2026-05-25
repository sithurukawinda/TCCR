import { GetUsersUseCase }                     from '../../../src/application/use-cases/GetUsersUseCase';
import { IUserRepository, FindAllResult }       from '../../../src/domain/repositories/IUserRepository';
import { User }                                 from '../../../src/domain/entities/User';

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
});

describe('GetUsersUseCase', () => {
  let repo:    jest.Mocked<IUserRepository>;
  let useCase: GetUsersUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new GetUsersUseCase(repo);
  });

  describe('admin caller', () => {
    it('passes opts through unmodified for admin', async () => {
      const result: FindAllResult = { items: [makeUser()], nextCursor: null, total: 1 };
      repo.findAll.mockResolvedValue(result);

      const output = await useCase.execute({ limit: 10 }, ['admin']);

      expect(output).toEqual(result);
      expect(repo.findAll).toHaveBeenCalledWith({ limit: 10 });
    });

    it('passes filter options through unmodified for super_admin', async () => {
      const result: FindAllResult = { items: [], nextCursor: null, total: 0 };
      repo.findAll.mockResolvedValue(result);

      await useCase.execute({ limit: 5, role: 'admin', status: 'approved' }, ['super_admin']);

      expect(repo.findAll).toHaveBeenCalledWith({ limit: 5, role: 'admin', status: 'approved' });
    });
  });

  describe('non-admin caller (leader / g12)', () => {
    it('scopes to approved non-admin users for leader', async () => {
      const result: FindAllResult = { items: [makeUser()], nextCursor: null, total: 1 };
      repo.findAll.mockResolvedValue(result);

      const output = await useCase.execute({ limit: 10 }, ['leader']);

      expect(output).toEqual(result);
      expect(repo.findAll).toHaveBeenCalledWith({
        limit:        10,
        status:       'approved',
        excludeRoles: ['admin', 'super_admin'],
      });
    });

    it('scopes to approved non-admin users for g12', async () => {
      const result: FindAllResult = { items: [], nextCursor: null, total: 0 };
      repo.findAll.mockResolvedValue(result);

      await useCase.execute({ limit: 20, name: 'John' }, ['member', 'g12']);

      expect(repo.findAll).toHaveBeenCalledWith({
        limit:        20,
        name:         'John',
        status:       'approved',
        excludeRoles: ['admin', 'super_admin'],
      });
    });

    it('overrides caller-supplied status with approved', async () => {
      const result: FindAllResult = { items: [], nextCursor: null, total: 0 };
      repo.findAll.mockResolvedValue(result);

      await useCase.execute({ limit: 10, status: 'pending_approval' }, ['leader']);

      expect(repo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved' }),
      );
    });

    it('defaults callerRoles to [] which triggers non-admin scoping', async () => {
      const result: FindAllResult = { items: [], nextCursor: null, total: 0 };
      repo.findAll.mockResolvedValue(result);

      await useCase.execute({ limit: 10 });

      expect(repo.findAll).toHaveBeenCalledWith({
        limit:        10,
        status:       'approved',
        excludeRoles: ['admin', 'super_admin'],
      });
    });
  });

  it('propagates repo errors', async () => {
    repo.findAll.mockRejectedValue(new Error('DB error'));
    await expect(useCase.execute({ limit: 10 }, ['admin'])).rejects.toThrow('DB error');
  });
});
