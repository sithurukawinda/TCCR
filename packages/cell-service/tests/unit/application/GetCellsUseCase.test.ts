import { GetCellsUseCase }       from '../../../src/application/use-cases/GetCellsUseCase';
import { ICellGroupRepository }  from '../../../src/domain/repositories/ICellGroupRepository';
import { UserServiceClient }     from '../../../src/infrastructure/clients/UserServiceClient';
import { CellGroup }             from '../../../src/domain/entities/CellGroup';

const makeRepo = (): jest.Mocked<ICellGroupRepository> => ({
  findById: jest.fn(), findByMember: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

const makeUserClient = (): jest.Mocked<UserServiceClient> =>
  ({ getMemberProfiles: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<UserServiceClient>);

const makeCell = (id: string, members: string[] = []): CellGroup =>
  new CellGroup({
    id, name: 'Test Cell', type: 'care', area: 'Colombo',
    leaderUid: 'leader-uid', g12LeaderUid: 'g12-uid',
    members, memberCount: members.length, reportCount: 0,
    state: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

const EMPTY_RESULT = { items: [], nextCursor: null, total: 0 };

describe('GetCellsUseCase', () => {
  let repo:       jest.Mocked<ICellGroupRepository>;
  let userClient: jest.Mocked<UserServiceClient>;
  let useCase:    GetCellsUseCase;
  const opts = { limit: 20 };

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    userClient = makeUserClient();
    useCase    = new GetCellsUseCase(repo, userClient);
    repo.findAll.mockResolvedValue(EMPTY_RESULT);
  });

  // ── role-scoping ──────────────────────────────────────────────────────────

  it('admin sees all cells across ALL states by default — no state filter applied', async () => {
    await useCase.execute(opts, 'admin-uid', ['admin']);

    expect(repo.findAll).toHaveBeenCalledWith(
      expect.not.objectContaining({ state: 'active' }),
    );
  });

  it('admin can filter by specific state when provided', async () => {
    await useCase.execute({ ...opts, state: 'archived' }, 'admin-uid', ['admin']);

    expect(repo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'archived' }),
    );
  });

  it('super_admin sees all cells across ALL states by default — no state filter applied', async () => {
    await useCase.execute(opts, 'sa-uid', ['super_admin']);

    expect(repo.findAll).toHaveBeenCalledWith(
      expect.not.objectContaining({ state: 'active' }),
    );
    expect(repo.findAll).toHaveBeenCalledWith(
      expect.not.objectContaining({ leaderUid: 'sa-uid' }),
    );
  });

  it('leader sees only their own cells — leaderUid auto-scoped', async () => {
    await useCase.execute(opts, 'leader-uid', ['leader']);

    expect(repo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ leaderUid: 'leader-uid', state: 'active' }),
    );
  });

  it('member/student sees all active cells — no uid scope', async () => {
    await useCase.execute(opts, 'member-uid', ['member']);

    expect(repo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'active' }),
    );
    expect(repo.findAll).toHaveBeenCalledWith(
      expect.not.objectContaining({ leaderUid: 'member-uid' }),
    );
  });

  it('g12 sees all cells — active by default', async () => {
    await useCase.execute(opts, 'g12-uid', ['g12']);

    expect(repo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'active' }),
    );
    expect(repo.findAll).toHaveBeenCalledWith(
      expect.not.objectContaining({ leaderUid: 'g12-uid' }),
    );
  });

  // ── member enrichment ─────────────────────────────────────────────────────

  it('enriches members with profiles from user-service', async () => {
    const cell = makeCell('cell-001', ['uid-a', 'uid-b']);
    repo.findAll.mockResolvedValue({ items: [cell], nextCursor: null, total: 1 });
    userClient.getMemberProfiles.mockResolvedValue([
      { uid: 'uid-a', firstName: 'Saman', lastName: 'Silva',  displayName: 'Saman Silva'  },
      { uid: 'uid-b', firstName: 'Nimal', lastName: 'Perera', displayName: 'Nimal Perera' },
    ]);

    const result = await useCase.execute(opts, 'admin-uid', ['admin']);

    expect(result.items[0].members).toEqual([
      { uid: 'uid-a', firstName: 'Saman', lastName: 'Silva',  displayName: 'Saman Silva'  },
      { uid: 'uid-b', firstName: 'Nimal', lastName: 'Perera', displayName: 'Nimal Perera' },
    ]);
  });

  it('deduplicates UIDs across cells before calling user-service', async () => {
    const cell1 = makeCell('c1', ['uid-a', 'uid-b']);
    const cell2 = makeCell('c2', ['uid-b', 'uid-c']); // uid-b is shared
    repo.findAll.mockResolvedValue({ items: [cell1, cell2], nextCursor: null, total: 2 });
    userClient.getMemberProfiles.mockResolvedValue([]);

    await useCase.execute(opts, 'admin-uid', ['admin']);

    // Called once with deduplicated 3 UIDs, not 4
    expect(userClient.getMemberProfiles).toHaveBeenCalledTimes(1);
    expect(userClient.getMemberProfiles).toHaveBeenCalledWith(
      expect.arrayContaining(['uid-a', 'uid-b', 'uid-c']),
    );
    const arg = userClient.getMemberProfiles.mock.calls[0][0] as string[];
    expect(arg).toHaveLength(3); // deduplicated
  });

  it('falls back to placeholder when user-service lookup fails for a member', async () => {
    const cell = makeCell('cell-001', ['uid-a', 'uid-missing']);
    repo.findAll.mockResolvedValue({ items: [cell], nextCursor: null, total: 1 });
    userClient.getMemberProfiles.mockResolvedValue([
      { uid: 'uid-a',       firstName: 'Saman', lastName: 'Silva', displayName: 'Saman Silva' },
      { uid: 'uid-missing', firstName: '',       lastName: '',      displayName: ''            },
    ]);

    const result = await useCase.execute(opts, 'admin-uid', ['admin']);

    expect(result.items[0].members[1]).toEqual(
      { uid: 'uid-missing', firstName: '', lastName: '', displayName: '' },
    );
  });

  it('skips user-service call when all cells have no members', async () => {
    const cell = makeCell('cell-001', []);
    repo.findAll.mockResolvedValue({ items: [cell], nextCursor: null, total: 1 });

    await useCase.execute(opts, 'admin-uid', ['admin']);

    expect(userClient.getMemberProfiles).toHaveBeenCalledWith([]);
  });

  it('preserves nextCursor and total from repository result', async () => {
    repo.findAll.mockResolvedValue({ items: [], nextCursor: 'cursor-xyz', total: 42 });

    const result = await useCase.execute(opts, 'admin-uid', ['admin']);

    expect(result.nextCursor).toBe('cursor-xyz');
    expect(result.total).toBe(42);
  });
});
