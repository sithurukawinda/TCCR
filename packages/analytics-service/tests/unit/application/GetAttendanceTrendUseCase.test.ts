import { GetAttendanceTrendUseCase } from '../../../src/application/use-cases/GetAttendanceTrendUseCase';
import { IAnalyticsRepository }      from '../../../src/domain/repositories/IAnalyticsRepository';
import { AnalyticsSnapshot }         from '../../../src/domain/entities/AnalyticsSnapshot';

const makeRepo = (): jest.Mocked<IAnalyticsRepository> => ({
  findByScope: jest.fn(), findLatestByScope: jest.fn(),
});

const makeSnap = (periodKey: string, scope = 'org'): AnalyticsSnapshot =>
  new AnalyticsSnapshot({
    id: `${scope}_${periodKey}`, scope, periodKey,
    metrics: {
      cellCount: 3, activeCells: 3, reportCount: 5,
      attendance: { present: 10, absent: 2, visitors: 1, children: 0, newAttendees: 3 },
      meetingTypeBreakdown: { g12: 1, care: 1, children: 1, outreach: 0 },
      memberGrowth: 2, participationRate: 0.8, averageSatisfaction: 4,
      participationByLeader: [],
    },
    computedAt: '2026-01-01T00:00:00Z',
  });

describe('GetAttendanceTrendUseCase', () => {
  let repo:    jest.Mocked<IAnalyticsRepository>;
  let useCase: GetAttendanceTrendUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new GetAttendanceTrendUseCase(repo);
  });

  it('returns org scope for admin role', async () => {
    repo.findByScope.mockResolvedValue([makeSnap('2026-W01', 'org')]);

    const result = await useCase.execute('admin-uid', ['admin']);

    expect(result.scope).toBe('org');
    expect(repo.findByScope).toHaveBeenCalledWith('org', undefined, undefined, 52);
  });

  it('returns leader scope for leader role', async () => {
    repo.findByScope.mockResolvedValue([]);

    const result = await useCase.execute('leader-uid', ['member', 'leader']);

    expect(result.scope).toBe('leader:leader-uid');
    expect(repo.findByScope).toHaveBeenCalledWith('leader:leader-uid', undefined, undefined, 52);
  });

  it('returns g12 scope for g12 role', async () => {
    repo.findByScope.mockResolvedValue([]);

    const result = await useCase.execute('g12-uid', ['g12']);

    expect(result.scope).toBe('g12:g12-uid');
  });

  it('maps snapshot attendance metrics to response shape', async () => {
    repo.findByScope.mockResolvedValue([makeSnap('2026-W10')]);

    const result = await useCase.execute('admin-uid', ['admin']);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      periodKey:    '2026-W10',
      present:      10,
      absent:       2,
      visitors:     1,
      children:     0,
      newAttendees: 3,
    });
  });

  it('returns empty data array when no snapshots exist', async () => {
    repo.findByScope.mockResolvedValue([]);

    const result = await useCase.execute('admin-uid', ['admin']);

    expect(result.data).toEqual([]);
  });

  it('passes from/to filters to repository', async () => {
    repo.findByScope.mockResolvedValue([]);

    await useCase.execute('admin-uid', ['admin'], '2026-W01', '2026-W10');

    expect(repo.findByScope).toHaveBeenCalledWith('org', '2026-W01', '2026-W10', 52);
  });

  it('returns multiple periods in order from repository', async () => {
    const snaps = ['2026-W01', '2026-W02', '2026-W03'].map(k => makeSnap(k));
    repo.findByScope.mockResolvedValue(snaps);

    const result = await useCase.execute('admin-uid', ['super_admin']);

    expect(result.data.map(d => d.periodKey)).toEqual(['2026-W01', '2026-W02', '2026-W03']);
  });
});
