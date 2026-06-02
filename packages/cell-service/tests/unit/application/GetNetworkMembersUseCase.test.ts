import { GetNetworkMembersUseCase } from '../../../src/application/use-cases/GetNetworkMembersUseCase';
import { ICellGroupRepository }     from '../../../src/domain/repositories/ICellGroupRepository';
import { UserServiceClient }        from '../../../src/infrastructure/clients/UserServiceClient';
import { CellGroup }                from '../../../src/domain/entities/CellGroup';

const makeRepo = (): jest.Mocked<ICellGroupRepository> => ({
  findById: jest.fn(), findByMember: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

const makeUserClient = (): jest.Mocked<UserServiceClient> =>
  ({ getMemberProfiles: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<UserServiceClient>);

const makeCell = (
  id: string,
  members: string[] = [],
  externalMembers: Array<{ id: string; name: string; phone?: string }> = [],
): CellGroup =>
  new CellGroup({
    id, name: `Cell ${id}`, type: 'care', area: 'Colombo',
    leaderUid: 'leader-uid', g12LeaderUid: 'g12-uid',
    members, externalMembers, memberCount: members.length + externalMembers.length,
    reportCount: 0, state: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

const EMPTY_RESULT = { items: [], nextCursor: null, total: 0 };

describe('GetNetworkMembersUseCase', () => {
  let repo:       jest.Mocked<ICellGroupRepository>;
  let userClient: jest.Mocked<UserServiceClient>;
  let useCase:    GetNetworkMembersUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo       = makeRepo();
    userClient = makeUserClient();
    useCase    = new GetNetworkMembersUseCase(repo, userClient);
    repo.findAll.mockResolvedValue(EMPTY_RESULT);
  });

  // ── authorisation ──────────────────────────────────────────────────────────

  it('throws 403 FORBIDDEN for member/student callers', async () => {
    await expect(useCase.execute('member-uid', ['member'])).rejects.toMatchObject({
      status: 403, errorCode: 'FORBIDDEN',
    });
  });

  it('allows g12 callers', async () => {
    await expect(useCase.execute('g12-uid', ['g12'])).resolves.toBeDefined();
  });

  it('allows admin callers', async () => {
    await expect(useCase.execute('admin-uid', ['admin'])).resolves.toBeDefined();
  });

  // ── empty network ──────────────────────────────────────────────────────────

  it('returns zero totals and skips user-service when no cells exist', async () => {
    const result = await useCase.execute('g12-uid', ['g12']);

    expect(result).toEqual({ items: [], totalCells: 0, totalMembers: 0 });
    expect(userClient.getMemberProfiles).not.toHaveBeenCalled();
  });

  // ── batching ───────────────────────────────────────────────────────────────

  it('makes exactly ONE getMemberProfiles call with all UIDs from a single cell', async () => {
    const cell = makeCell('c1', ['uid-a', 'uid-b']);
    repo.findAll.mockResolvedValue({ items: [cell], nextCursor: null, total: 1 });
    userClient.getMemberProfiles.mockResolvedValue([
      { uid: 'uid-a', firstName: 'Saman', lastName: 'Silva',  displayName: 'Saman Silva'  },
      { uid: 'uid-b', firstName: 'Nimal', lastName: 'Perera', displayName: 'Nimal Perera' },
    ]);

    const result = await useCase.execute('g12-uid', ['g12']);

    expect(userClient.getMemberProfiles).toHaveBeenCalledTimes(1);
    expect(userClient.getMemberProfiles).toHaveBeenCalledWith(['uid-a', 'uid-b']);
    expect(result.items[0].members).toHaveLength(2);
    expect(result.totalMembers).toBe(2);
    expect(result.totalCells).toBe(1);
  });

  it('deduplicates UIDs shared across two cells — still ONE call, not two', async () => {
    const cell1 = makeCell('c1', ['uid-a', 'uid-b']);
    const cell2 = makeCell('c2', ['uid-b', 'uid-c']); // uid-b is shared
    repo.findAll.mockResolvedValue({ items: [cell1, cell2], nextCursor: null, total: 2 });
    userClient.getMemberProfiles.mockResolvedValue([]);

    await useCase.execute('g12-uid', ['g12']);

    expect(userClient.getMemberProfiles).toHaveBeenCalledTimes(1);
    const calledUids = userClient.getMemberProfiles.mock.calls[0][0] as string[];
    expect(calledUids).toHaveLength(3);
    expect(calledUids).toEqual(expect.arrayContaining(['uid-a', 'uid-b', 'uid-c']));
  });

  it('maps profiles back to their owning cells correctly', async () => {
    const cell1 = makeCell('c1', ['uid-a']);
    const cell2 = makeCell('c2', ['uid-b']);
    repo.findAll.mockResolvedValue({ items: [cell1, cell2], nextCursor: null, total: 2 });
    userClient.getMemberProfiles.mockResolvedValue([
      { uid: 'uid-a', firstName: 'A', lastName: 'One', displayName: 'A One' },
      { uid: 'uid-b', firstName: 'B', lastName: 'Two', displayName: 'B Two' },
    ]);

    const result = await useCase.execute('admin-uid', ['admin']);

    expect(result.items[0].members[0]).toMatchObject({ uid: 'uid-a', type: 'registered' });
    expect(result.items[1].members[0]).toMatchObject({ uid: 'uid-b', type: 'registered' });
  });

  // ── external members ───────────────────────────────────────────────────────

  it('includes external members without calling user-service for them', async () => {
    const ext = [{ id: 'ext-1', name: 'John Doe', phone: '+94777000001' }];
    const cell = makeCell('c1', [], ext);
    repo.findAll.mockResolvedValue({ items: [cell], nextCursor: null, total: 1 });

    const result = await useCase.execute('admin-uid', ['admin']);

    expect(result.items[0].members).toHaveLength(1);
    expect(result.items[0].members[0]).toMatchObject({
      type: 'external', id: 'ext-1', name: 'John Doe', displayName: 'John Doe', uid: null,
    });
    expect(userClient.getMemberProfiles).toHaveBeenCalledWith([]); // no registered members
  });

  it('combines registered and external members in the same cell', async () => {
    const ext = [{ id: 'ext-1', name: 'Visitor' }];
    const cell = makeCell('c1', ['uid-a'], ext);
    repo.findAll.mockResolvedValue({ items: [cell], nextCursor: null, total: 1 });
    userClient.getMemberProfiles.mockResolvedValue([
      { uid: 'uid-a', firstName: 'Saman', lastName: 'Silva', displayName: 'Saman Silva' },
    ]);

    const result = await useCase.execute('admin-uid', ['admin']);

    expect(result.items[0].members).toHaveLength(2);
    expect(result.items[0].members[0]).toMatchObject({ type: 'registered', uid: 'uid-a' });
    expect(result.items[0].members[1]).toMatchObject({ type: 'external',   id:  'ext-1' });
  });
});
