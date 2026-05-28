import { GetNetworkSummaryUseCase } from '../../../src/application/use-cases/GetNetworkSummaryUseCase';
import { ICellGroupRepository }     from '../../../src/domain/repositories/ICellGroupRepository';
import { ICellReportRepository }    from '../../../src/domain/repositories/ICellReportRepository';
import { UserServiceClient }        from '../../../src/infrastructure/clients/UserServiceClient';
import { CellGroup }                from '../../../src/domain/entities/CellGroup';
import { CellReport }               from '../../../src/domain/entities/CellReport';
import { Role }                     from '@shared/auth-middleware';

// ── Factories ─────────────────────────────────────────────────────────────────

const makeCellRepo = (): jest.Mocked<ICellGroupRepository> => ({
  findById: jest.fn(), findByMember: jest.fn(), findAll: jest.fn(),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

const makeReportRepo = (): jest.Mocked<ICellReportRepository> => ({
  findById: jest.fn(), findByClientReqId: jest.fn(), findAll: jest.fn(),
  findByPeriod: jest.fn(),
  create: jest.fn(), update: jest.fn(),
});

const makeUserClient = (): jest.Mocked<Pick<UserServiceClient, 'getMemberProfiles'>> => ({
  getMemberProfiles: jest.fn().mockResolvedValue([]),
});

const makeCell = (id = 'c1', leaderUid = 'leader-1', g12LeaderUid = 'g12-1'): CellGroup =>
  new CellGroup({
    id, name: `Cell ${id}`, type: 'care', area: 'Area',
    leaderUid, g12LeaderUid,
    members: [leaderUid], memberCount: 1, reportCount: 1,
    state: 'active', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  });

const makeReport = (id: string, cellId: string, date: string, overrides: Partial<{
  didMeet: boolean; attendance: { userUid: string; name: string; status: 'present' | 'absent'; isNew: boolean }[];
  satisfactionRate: number; cellType: 'care' | 'g12' | 'children' | 'outreach';
}> = {}): CellReport =>
  new CellReport({
    id, cellId, filledByUid: 'leader-1', clientReqId: `crq-${id}`,
    date, didMeet: true, noMeetReason: null, leaderPresent: true,
    conductedByIfAbsent: null, location: 'Home', timeStarted: '18:00', timeEnded: '20:00',
    language: 'en', subjectDiscussed: 'sunday_sermon', otherSubjectReason: null,
    cellType: overrides.cellType ?? 'care', g12LeaderUid: 'g12-1', immediateG12LeaderText: null,
    attendance: overrides.attendance ?? [],
    contactedAbsentees: 'no', absenteeNotes: null,
    additionalVisitors: 0, childrenCount: 0,
    satisfactionRate: overrides.satisfactionRate ?? 4,
    additionalInfo: null, photoUrls: [], voided: false,
    createdAt: `${date}T09:00:00Z`,
    ...('didMeet' in overrides ? { didMeet: overrides.didMeet! } : {}),
  });

const EMPTY_PAGE = { items: [], nextCursor: null, total: 0 };

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('GetNetworkSummaryUseCase', () => {
  let cellRepo:   jest.Mocked<ICellGroupRepository>;
  let reportRepo: jest.Mocked<ICellReportRepository>;
  let userClient: jest.Mocked<Pick<UserServiceClient, 'getMemberProfiles'>>;
  let useCase:    GetNetworkSummaryUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    cellRepo   = makeCellRepo();
    reportRepo = makeReportRepo();
    userClient = makeUserClient();
    useCase    = new GetNetworkSummaryUseCase(
      cellRepo,
      reportRepo,
      userClient as unknown as UserServiceClient,
    );
  });

  // ── Date range defaults ───────────────────────────────────────────────────

  it('resolves to as today when omitted', async () => {
    cellRepo.findAll.mockResolvedValue(EMPTY_PAGE);

    const result = await useCase.execute('g12-1', ['g12'] as Role[], '2026-01-01');

    const today = new Date().toISOString().slice(0, 10);
    expect(result.to).toBe(today);
    expect(result.from).toBe('2026-01-01');
  });

  it('uses the explicit to when provided', async () => {
    cellRepo.findAll.mockResolvedValue(EMPTY_PAGE);

    const result = await useCase.execute('g12-1', ['g12'] as Role[], '2026-01-01', '2026-03-31');

    expect(result.from).toBe('2026-01-01');
    expect(result.to).toBe('2026-03-31');
  });

  // ── Period label ──────────────────────────────────────────────────────────

  it('returns single-month period label when from and to are in the same month', async () => {
    cellRepo.findAll.mockResolvedValue(EMPTY_PAGE);

    const result = await useCase.execute('g12-1', ['g12'] as Role[], '2026-05-01', '2026-05-31');

    expect(result.period).toBe('May 2026');
  });

  it('returns a date-range period label when from and to span multiple months', async () => {
    cellRepo.findAll.mockResolvedValue(EMPTY_PAGE);

    const result = await useCase.execute('g12-1', ['g12'] as Role[], '2025-05-20', '2026-04-10');

    // e.g. "20 May 2025 – 10 Apr 2026"
    expect(result.period).toMatch(/May 2025/);
    expect(result.period).toMatch(/Apr 2026/);
    expect(result.period).toContain('–');
  });

  // ── Weekly breakdown (≤ 31 days → W1…W4) ─────────────────────────────────

  it('uses week-of-month labels for a single-month range', async () => {
    const cell = makeCell();
    cellRepo.findAll.mockResolvedValue({ items: [cell], nextCursor: null, total: 1 });
    reportRepo.findByPeriod.mockResolvedValue([
      makeReport('r1', 'c1', '2026-05-05'),  // W1
      makeReport('r2', 'c1', '2026-05-12'),  // W2
      makeReport('r3', 'c1', '2026-05-20'),  // W3
    ]);

    const result = await useCase.execute('g12-1', ['g12'] as Role[], '2026-05-01', '2026-05-31');

    const labels = result.weeklyBreakdown.map(b => b.weekLabel);
    expect(labels.every(l => /^W\d$/.test(l))).toBe(true);
  });

  // ── Monthly breakdown (> 31 days → "May '25", "Jun '25" …) ───────────────

  it('uses calendar-month labels for a multi-month range', async () => {
    const cell = makeCell();
    cellRepo.findAll.mockResolvedValue({ items: [cell], nextCursor: null, total: 1 });
    reportRepo.findByPeriod.mockResolvedValue([
      makeReport('r1', 'c1', '2025-05-15'),
      makeReport('r2', 'c1', '2025-07-10'),
      makeReport('r3', 'c1', '2026-01-20'),
    ]);

    const result = await useCase.execute('g12-1', ['g12'] as Role[], '2025-05-01', '2026-01-31');

    const labels = result.weeklyBreakdown.map(b => b.weekLabel);
    expect(labels).toContain("May '25");
    expect(labels).toContain("Jul '25");
    expect(labels).toContain("Jan '26");
    // No week-of-month labels
    expect(labels.some(l => /^W\d$/.test(l))).toBe(false);
  });

  it('monthly breakdown is sorted chronologically', async () => {
    const cell = makeCell();
    cellRepo.findAll.mockResolvedValue({ items: [cell], nextCursor: null, total: 1 });
    reportRepo.findByPeriod.mockResolvedValue([
      makeReport('r3', 'c1', '2025-09-10'),
      makeReport('r1', 'c1', '2025-05-15'),
      makeReport('r2', 'c1', '2025-07-20'),
    ]);

    const result = await useCase.execute('g12-1', ['g12'] as Role[], '2025-05-01', '2026-01-31');

    const labels = result.weeklyBreakdown.map(b => b.weekLabel);
    expect(labels.indexOf("May '25")).toBeLessThan(labels.indexOf("Jul '25"));
    expect(labels.indexOf("Jul '25")).toBeLessThan(labels.indexOf("Sep '25"));
  });

  // ── Core aggregations ─────────────────────────────────────────────────────

  it('returns zero totals when no cells exist', async () => {
    cellRepo.findAll.mockResolvedValue(EMPTY_PAGE);

    const result = await useCase.execute('g12-1', ['g12'] as Role[], '2026-05-01', '2026-05-31');

    expect(result.summary.reportsFiled).toBe(0);
    expect(result.summary.cellsHeld).toBe(0);
    expect(result.attendance.present).toBe(0);
    expect(result.weeklyBreakdown).toHaveLength(0);
  });

  it('counts reportsFiled and cellsHeld correctly', async () => {
    const cells = [makeCell('c1'), makeCell('c2')];
    cellRepo.findAll.mockResolvedValue({ items: cells, nextCursor: null, total: 2 });
    reportRepo.findByPeriod
      .mockResolvedValueOnce([makeReport('r1', 'c1', '2026-05-10'), makeReport('r2', 'c1', '2026-05-17')])
      .mockResolvedValueOnce([makeReport('r3', 'c2', '2026-05-10')]);

    const result = await useCase.execute('g12-1', ['g12'] as Role[], '2026-05-01', '2026-05-31');

    expect(result.summary.reportsFiled).toBe(3);
    expect(result.summary.cellsHeld).toBe(2);
  });

  it('sums attendance present across all reports', async () => {
    const cell = makeCell();
    cellRepo.findAll.mockResolvedValue({ items: [cell], nextCursor: null, total: 1 });
    reportRepo.findByPeriod.mockResolvedValue([
      makeReport('r1', 'c1', '2026-05-10', {
        attendance: [
          { userUid: 'u1', name: 'A', status: 'present', isNew: false },
          { userUid: 'u2', name: 'B', status: 'absent',  isNew: false },
        ],
      }),
      makeReport('r2', 'c1', '2026-05-17', {
        attendance: [
          { userUid: 'u1', name: 'A', status: 'present', isNew: false },
          { userUid: 'u3', name: 'C', status: 'present', isNew: false },
        ],
      }),
    ]);

    const result = await useCase.execute('g12-1', ['g12'] as Role[], '2026-05-01', '2026-05-31');

    expect(result.attendance.present).toBe(3); // 1 + 2
  });

  it('identifies unreported cells correctly', async () => {
    const cells = [makeCell('c1'), makeCell('c2', 'leader-2')];
    cellRepo.findAll.mockResolvedValue({ items: cells, nextCursor: null, total: 2 });
    reportRepo.findByPeriod
      .mockResolvedValueOnce([makeReport('r1', 'c1', '2026-05-10')]) // c1 reported
      .mockResolvedValueOnce([]);                                      // c2 did not

    const result = await useCase.execute('g12-1', ['g12'] as Role[], '2026-05-01', '2026-05-31');

    expect(result.unreportedCells).toHaveLength(1);
    expect(result.unreportedCells[0].id).toBe('c2');
  });

  // ── Role scoping ──────────────────────────────────────────────────────────

  it('G12 queries all active cells with no UID filter', async () => {
    cellRepo.findAll.mockResolvedValue(EMPTY_PAGE);

    await useCase.execute('g12-uid', ['g12'] as Role[], '2026-05-01', '2026-05-31');

    expect(cellRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'active' }),
    );
    expect(cellRepo.findAll).toHaveBeenCalledWith(
      expect.not.objectContaining({ leaderUid: expect.anything() }),
    );
  });

  it('leader queries cells filtered by their own leaderUid', async () => {
    cellRepo.findAll.mockResolvedValue(EMPTY_PAGE);

    await useCase.execute('leader-uid', ['leader'] as Role[], '2026-05-01', '2026-05-31');

    expect(cellRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ leaderUid: 'leader-uid', state: 'active' }),
    );
  });

  // ── 403 ───────────────────────────────────────────────────────────────────

  it('throws 403 when called by a regular member', async () => {
    await expect(
      useCase.execute('member-uid', ['member'] as Role[], '2026-05-01', '2026-05-31'),
    ).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
  });
});
