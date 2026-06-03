import { GetMasterUseCase } from '../../../src/application/use-cases/GetMasterUseCase';
import { IUserRepository }  from '../../../src/domain/repositories/IUserRepository';
import { User }             from '../../../src/domain/entities/User';

const makeUser = (overrides = {}): User =>
  new User({
    uid: 'master-uid', email: 'master@example.com', firstName: 'M',
    lastName: 'U', role: 'member', roles: ['member', 'master'], status: 'approved',
    profilePhotoUrl: null, createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null, ...overrides,
  });

const makeRepo = (): jest.Mocked<IUserRepository> => ({
  findById:        jest.fn(),
  findByEmail:     jest.fn(),
  findAll:         jest.fn(),
  create:          jest.fn(),
  update:          jest.fn(),
  softDelete:      jest.fn(),
  hardDelete:      jest.fn(),
  atomicAddRole:   jest.fn(),
  atomicRemoveRole: jest.fn(),
});

describe('GetMasterUseCase', () => {
  let repo:    jest.Mocked<IUserRepository>;
  let useCase: GetMasterUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new GetMasterUseCase(repo);
  });

  it('returns the active (non-suspended) master', async () => {
    const active = makeUser({ status: 'approved' });
    repo.findAll.mockResolvedValue({ items: [active], nextCursor: null, total: 1 });

    const result = await useCase.execute();

    expect(result?.uid).toBe('master-uid');
    expect(result?.status).toBe('approved');
  });

  it('falls back to the first master when all are suspended', async () => {
    const suspended = makeUser({ uid: 'suspended-master', status: 'suspended' });
    repo.findAll.mockResolvedValue({ items: [suspended], nextCursor: null, total: 1 });

    const result = await useCase.execute();

    expect(result?.uid).toBe('suspended-master');
  });

  it('returns null when no master users exist', async () => {
    repo.findAll.mockResolvedValue({ items: [], nextCursor: null, total: 0 });

    const result = await useCase.execute();

    expect(result).toBeNull();
  });

  it('prefers active master over suspended when both exist', async () => {
    const suspended = makeUser({ uid: 'suspended-uid', status: 'suspended' });
    const active    = makeUser({ uid: 'active-uid', status: 'approved' });
    repo.findAll.mockResolvedValue({ items: [suspended, active], nextCursor: null, total: 2 });

    const result = await useCase.execute();

    expect(result?.uid).toBe('active-uid');
  });
});
