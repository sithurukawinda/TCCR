import { GetUserSummaryUseCase } from '../../../src/application/use-cases/GetUserSummaryUseCase';
import { IUserRepository }       from '../../../src/domain/repositories/IUserRepository';
import { User, UserRole }        from '../../../src/domain/entities/User';

const makeRepo = (): jest.Mocked<IUserRepository> => ({
  findAll:    jest.fn(),
  findById:   jest.fn(),
  create:     jest.fn(),
  update:     jest.fn(),
  softDelete: jest.fn(),
  hardDelete: jest.fn(),
} as unknown as jest.Mocked<IUserRepository>);

const makeUser = (uid: string, roles: string[], overrides: Partial<{
  firstName: string; lastName: string; phoneNumber: string | null;
  profilePhotoUrl: string | null; createdAt: string;
}> = {}): User =>
  new User({
    uid,
    email:           `${uid}@tccr.lk`,
    roles:           roles as UserRole[],
    role:            roles[roles.length - 1] as UserRole,
    firstName:       overrides.firstName       ?? 'First',
    lastName:        overrides.lastName        ?? 'Last',
    phoneNumber:     overrides.phoneNumber     ?? null,
    profilePhotoUrl: overrides.profilePhotoUrl ?? null,
    status:          'approved',
    createdAt:       overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt:       '2026-01-01T00:00:00.000Z',
    deletedAt:       null,
  });

const EMPTY = { items: [], nextCursor: null, total: 0 };

describe('GetUserSummaryUseCase', () => {
  let repo:    jest.Mocked<IUserRepository>;
  let useCase: GetUserSummaryUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new GetUserSummaryUseCase(repo);
  });

  // ── grouping ──────────────────────────────────────────────────────────────

  it('groups users into correct buckets by highest role', async () => {
    repo.findAll.mockResolvedValueOnce({
      items: [
        makeUser('sa1',  ['super_admin']),
        makeUser('adm1', ['admin']),
        makeUser('g1',   ['member', 'g12']),
        makeUser('ldr1', ['member', 'leader']),
        makeUser('stu1', ['member', 'student']),
        makeUser('mem1', ['member']),
      ],
      nextCursor: null, total: 6,
    });

    const result = await useCase.execute(['admin']);

    expect(result.superAdmins).toHaveLength(1);
    expect(result.admins).toHaveLength(1);
    expect(result.g12).toHaveLength(1);
    expect(result.leaders).toHaveLength(1);
    expect(result.students).toHaveLength(1);
    expect(result.members).toHaveLength(1);
    expect(result.totals.total).toBe(6);
  });

  it('places a user with [member, student, leader] into leaders only', async () => {
    repo.findAll.mockResolvedValueOnce({
      items: [makeUser('u1', ['member', 'student', 'leader'])],
      nextCursor: null, total: 1,
    });

    const result = await useCase.execute(['admin']);

    expect(result.leaders).toHaveLength(1);
    expect(result.students).toHaveLength(0);
    expect(result.members).toHaveLength(0);
    expect(result.leaders[0].uid).toBe('u1');
  });

  // ── profile shape ─────────────────────────────────────────────────────────

  it('returns correct SummaryProfile shape with roles, phoneNumber, createdAt', async () => {
    repo.findAll.mockResolvedValueOnce({
      items: [makeUser('ldr1', ['member', 'leader'], {
        firstName: 'Saman', lastName: 'Silva',
        phoneNumber: '+94771234567',
        profilePhotoUrl: 'https://example.com/photo.jpg',
        createdAt: '2026-03-15T08:00:00.000Z',
      })],
      nextCursor: null, total: 1,
    });

    const result = await useCase.execute(['admin']);
    const profile = result.leaders[0];

    expect(profile).toMatchObject({
      uid:             'ldr1',
      firstName:       'Saman',
      lastName:        'Silva',
      displayName:     'Saman Silva',
      email:           'ldr1@tccr.lk',
      roles:           ['member', 'leader'],
      phoneNumber:     '+94771234567',
      profilePhotoUrl: 'https://example.com/photo.jpg',
      createdAt:       '2026-03-15T08:00:00.000Z',
    });
  });

  it('displayName falls back to email when both names are empty', async () => {
    repo.findAll.mockResolvedValueOnce({
      items: [makeUser('u1', ['member'], { firstName: '', lastName: '' })],
      nextCursor: null, total: 1,
    });

    const result = await useCase.execute(['admin']);
    expect(result.members[0].displayName).toBe('u1@tccr.lk');
  });

  // ── sorting ───────────────────────────────────────────────────────────────

  it('sorts each group alphabetically by displayName', async () => {
    repo.findAll.mockResolvedValueOnce({
      items: [
        makeUser('c', ['member', 'leader'], { firstName: 'Charlie', lastName: '' }),
        makeUser('a', ['member', 'leader'], { firstName: 'Alice',   lastName: '' }),
        makeUser('b', ['member', 'leader'], { firstName: 'Bob',     lastName: '' }),
      ],
      nextCursor: null, total: 3,
    });

    const result = await useCase.execute(['admin']);
    const names  = result.leaders.map(p => p.displayName);

    expect(names).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  // ── totals ────────────────────────────────────────────────────────────────

  it('returns accurate totals for each group', async () => {
    repo.findAll.mockResolvedValueOnce({
      items: [
        makeUser('s1', ['super_admin']),
        makeUser('l1', ['member', 'leader']),
        makeUser('l2', ['member', 'leader']),
        makeUser('m1', ['member']),
      ],
      nextCursor: null, total: 4,
    });

    const result = await useCase.execute(['admin']);

    expect(result.totals).toEqual({
      superAdmins: 1, admins: 0, g12: 0,
      leaders: 2, students: 0, members: 1, total: 4,
    });
  });

  // ── cursor pagination ─────────────────────────────────────────────────────

  it('drains all pages using cursor pagination', async () => {
    repo.findAll
      .mockResolvedValueOnce({
        items: [makeUser('u1', ['member'])],
        nextCursor: 'cursor-page-2', total: 2,
      })
      .mockResolvedValueOnce({
        items: [makeUser('u2', ['member', 'leader'])],
        nextCursor: null, total: 2,
      });

    const result = await useCase.execute(['admin']);

    expect(repo.findAll).toHaveBeenCalledTimes(2);
    expect(result.totals.total).toBe(2);
    expect(result.members).toHaveLength(1);
    expect(result.leaders).toHaveLength(1);
  });

  // ── scoped access ─────────────────────────────────────────────────────────

  it('passes excludeRoles filter for non-admin callers', async () => {
    repo.findAll.mockResolvedValueOnce(EMPTY);

    await useCase.execute(['leader'] as any);

    expect(repo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ excludeRoles: ['admin', 'super_admin'] }),
    );
  });

  it('does NOT pass excludeRoles filter for admin callers', async () => {
    repo.findAll.mockResolvedValueOnce(EMPTY);

    await useCase.execute(['admin'] as any);

    expect(repo.findAll).toHaveBeenCalledWith(
      expect.not.objectContaining({ excludeRoles: expect.anything() }),
    );
  });

  it('returns empty groups when no users exist', async () => {
    repo.findAll.mockResolvedValueOnce(EMPTY);

    const result = await useCase.execute(['admin']);

    expect(result.totals.total).toBe(0);
    expect(result.members).toHaveLength(0);
    expect(result.superAdmins).toHaveLength(0);
  });
});
