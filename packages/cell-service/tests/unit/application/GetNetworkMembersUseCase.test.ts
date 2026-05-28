import { GetNetworkMembersUseCase } from '../../../src/application/use-cases/GetNetworkMembersUseCase';
import { ICellGroupRepository }     from '../../../src/domain/repositories/ICellGroupRepository';
import { UserServiceClient }         from '../../../src/infrastructure/clients/UserServiceClient';
import { CellGroup }                 from '../../../src/domain/entities/CellGroup';
import { Role }                      from '@shared/auth-middleware';

const makeRepo = (): jest.Mocked<ICellGroupRepository> => ({
  findById: jest.fn(), findByMember: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

const makeUserClient = (): jest.Mocked<Pick<UserServiceClient, 'getMemberProfiles'>> => ({
  getMemberProfiles: jest.fn(),
});

const makeCell = (
  id: string,
  members: string[],
  overrides: Partial<ConstructorParameters<typeof CellGroup>[0]> = {},
): CellGroup =>
  new CellGroup({
    id, name: `Cell ${id}`, type: 'care', area: 'Area',
    leaderUid: 'leader-1', g12LeaderUid: 'g12-1',
    members, memberCount: members.length, reportCount: 0,
    state: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  });

const makeProfile = (uid: string) => ({
  uid,
  firstName:   `First-${uid}`,
  lastName:    `Last-${uid}`,
  displayName: `First-${uid} Last-${uid}`,
});

const EMPTY_PAGE = { items: [], nextCursor: null, total: 0 };

describe('GetNetworkMembersUseCase', () => {
  let cellRepo:    jest.Mocked<ICellGroupRepository>;
  let userClient:  jest.Mocked<Pick<UserServiceClient, 'getMemberProfiles'>>;
  let useCase:     GetNetworkMembersUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    cellRepo   = makeRepo();
    userClient = makeUserClient();
    useCase    = new GetNetworkMembersUseCase(
      cellRepo,
      userClient as unknown as UserServiceClient,
    );
  });

  // ── Core batch behaviour ──────────────────────────────────────────────────

  it('calls getMemberProfiles exactly once regardless of cell count', async () => {
    const cells = [
      makeCell('c1', ['uid-a', 'uid-b']),
      makeCell('c2', ['uid-c', 'uid-d']),
      makeCell('c3', ['uid-e']),
    ];
    cellRepo.findAll.mockResolvedValue({ items: cells, nextCursor: null, total: 3 });
    userClient.getMemberProfiles.mockResolvedValue([]);

    await useCase.execute('g12-1', ['g12'] as Role[]);

    expect(userClient.getMemberProfiles).toHaveBeenCalledTimes(1);
  });

  it('passes all unique UIDs in a single batch call', async () => {
    const cells = [
      makeCell('c1', ['uid-a', 'uid-b']),
      makeCell('c2', ['uid-c']),
    ];
    cellRepo.findAll.mockResolvedValue({ items: cells, nextCursor: null, total: 2 });
    userClient.getMemberProfiles.mockResolvedValue([]);

    await useCase.execute('g12-1', ['g12'] as Role[]);

    const calledWith = userClient.getMemberProfiles.mock.calls[0][0];
    expect(calledWith.sort()).toEqual(['uid-a', 'uid-b', 'uid-c']);
  });

  it('deduplicates UIDs that appear in multiple cells', async () => {
    // uid-shared appears in both cells
    const cells = [
      makeCell('c1', ['uid-shared', 'uid-a']),
      makeCell('c2', ['uid-shared', 'uid-b']),
    ];
    cellRepo.findAll.mockResolvedValue({ items: cells, nextCursor: null, total: 2 });
    userClient.getMemberProfiles.mockResolvedValue([]);

    await useCase.execute('g12-1', ['g12'] as Role[]);

    const calledWith = userClient.getMemberProfiles.mock.calls[0][0];
    expect(calledWith.filter((u: string) => u === 'uid-shared')).toHaveLength(1);
    expect(calledWith.sort()).toEqual(['uid-a', 'uid-b', 'uid-shared']);
  });

  it('distributes profiles to the correct cells', async () => {
    const cells = [
      makeCell('c1', ['uid-a', 'uid-b']),
      makeCell('c2', ['uid-c']),
    ];
    cellRepo.findAll.mockResolvedValue({ items: cells, nextCursor: null, total: 2 });
    userClient.getMemberProfiles.mockResolvedValue([
      makeProfile('uid-a'),
      makeProfile('uid-b'),
      makeProfile('uid-c'),
    ]);

    const result = await useCase.execute('g12-1', ['g12'] as Role[]);

    const c1 = result.items.find(i => i.cellId === 'c1')!;
    const c2 = result.items.find(i => i.cellId === 'c2')!;
    expect(c1.members.map(m => m.uid).sort()).toEqual(['uid-a', 'uid-b']);
    expect(c2.members.map(m => m.uid)).toEqual(['uid-c']);
  });

  it('returns correct totalMembers across all cells', async () => {
    const cells = [
      makeCell('c1', ['uid-a', 'uid-b']),
      makeCell('c2', ['uid-c']),
    ];
    cellRepo.findAll.mockResolvedValue({ items: cells, nextCursor: null, total: 2 });
    userClient.getMemberProfiles.mockResolvedValue([
      makeProfile('uid-a'), makeProfile('uid-b'), makeProfile('uid-c'),
    ]);

    const result = await useCase.execute('g12-1', ['g12'] as Role[]);

    expect(result.totalMembers).toBe(3);
    expect(result.totalCells).toBe(2);
  });

  // ── Empty network ─────────────────────────────────────────────────────────

  it('returns empty and skips user-service when no cells exist', async () => {
    cellRepo.findAll.mockResolvedValue(EMPTY_PAGE);

    const result = await useCase.execute('g12-1', ['g12'] as Role[]);

    expect(result).toEqual({ items: [], totalCells: 0, totalMembers: 0 });
    expect(userClient.getMemberProfiles).not.toHaveBeenCalled();
  });

  it('handles cells with no members without calling user-service', async () => {
    cellRepo.findAll.mockResolvedValue({
      items: [makeCell('c1', [])],
      nextCursor: null,
      total: 1,
    });
    userClient.getMemberProfiles.mockResolvedValue([]);

    const result = await useCase.execute('g12-1', ['g12'] as Role[]);

    expect(userClient.getMemberProfiles).toHaveBeenCalledWith([]);
    expect(result.items[0].members).toEqual([]);
    expect(result.totalMembers).toBe(0);
  });

  // ── Role scoping ──────────────────────────────────────────────────────────

  it('G12 queries all active cells with no UID scope', async () => {
    cellRepo.findAll.mockResolvedValue(EMPTY_PAGE);
    userClient.getMemberProfiles.mockResolvedValue([]);

    await useCase.execute('g12-uid', ['g12'] as Role[]);

    expect(cellRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'active' }),
    );
    expect(cellRepo.findAll).toHaveBeenCalledWith(
      expect.not.objectContaining({ leaderUid: expect.anything() }),
    );
  });

  it('leader queries cells filtered by their own leaderUid', async () => {
    cellRepo.findAll.mockResolvedValue(EMPTY_PAGE);

    await useCase.execute('leader-uid', ['leader'] as Role[]);

    expect(cellRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ leaderUid: 'leader-uid', state: 'active' }),
    );
  });

  it('admin queries all active cells with no UID scope', async () => {
    cellRepo.findAll.mockResolvedValue(EMPTY_PAGE);

    await useCase.execute('admin-uid', ['admin'] as Role[]);

    expect(cellRepo.findAll).toHaveBeenCalledWith(
      expect.not.objectContaining({ leaderUid: expect.anything() }),
    );
  });

  // ── 403 ───────────────────────────────────────────────────────────────────

  it('throws 403 when called by a regular member', async () => {
    await expect(
      useCase.execute('member-uid', ['member'] as Role[]),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
  });

  it('throws 403 when called by a student', async () => {
    await expect(
      useCase.execute('student-uid', ['member', 'student'] as Role[]),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
  });
});
