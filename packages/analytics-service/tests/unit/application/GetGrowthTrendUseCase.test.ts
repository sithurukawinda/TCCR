import { GetGrowthTrendUseCase } from '../../../src/application/use-cases/GetGrowthTrendUseCase';
import { IAnalyticsRepository }  from '../../../src/domain/repositories/IAnalyticsRepository';
import { AnalyticsSnapshot }     from '../../../src/domain/entities/AnalyticsSnapshot';

const makeRepo = (): jest.Mocked<IAnalyticsRepository> => ({
  findByScope: jest.fn(), findLatestByScope: jest.fn(),
});

const makeSnap = (periodKey: string, memberGrowth: number, participationRate: number): AnalyticsSnapshot =>
  new AnalyticsSnapshot({
    id: `org_${periodKey}`, scope: 'org', periodKey,
    metrics: {
      cellCount: 4, activeCells: 4, reportCount: 4,
      attendance: { present: 12, absent: 2, visitors: 1, children: 0, newAttendees: 2 },
      meetingTypeBreakdown: { g12: 2, care: 2, children: 0, outreach: 0 },
      memberGrowth, participationRate, averageSatisfaction: 4,
      participationByLeader: [],
    },
    computedAt: '2026-01-01T00:00:00Z',
  });

describe('GetGrowthTrendUseCase', () => {
  let repo:    jest.Mocked<IAnalyticsRepository>;
  let useCase: GetGrowthTrendUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new GetGrowthTrendUseCase(repo);
  });

  it('returns org scope for admin', async () => {
    repo.findByScope.mockResolvedValue([makeSnap('2026-W01', 5, 0.85)]);

    const result = await useCase.execute('admin-uid', ['admin']);

    expect(result.scope).toBe('org');
    expect(repo.findByScope).toHaveBeenCalledWith('org', undefined, undefined, 52);
  });

  it('maps memberGrowth and participationRate from snapshots', async () => {
    repo.findByScope.mockResolvedValue([makeSnap('2026-W05', 3, 0.75)]);

    const result = await useCase.execute('admin-uid', ['admin']);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      periodKey:         '2026-W05',
      memberGrowth:      3,
      participationRate: 0.75,
    });
  });

  it('returns empty data array when no snapshots', async () => {
    repo.findByScope.mockResolvedValue([]);

    const result = await useCase.execute('admin-uid', ['admin']);

    expect(result.data).toEqual([]);
  });

  it('passes date filters to repository', async () => {
    repo.findByScope.mockResolvedValue([]);

    await useCase.execute('admin-uid', ['admin'], '2026-W01', '2026-W12');

    expect(repo.findByScope).toHaveBeenCalledWith('org', '2026-W01', '2026-W12', 52);
  });

  it('uses leader scope for leader role', async () => {
    repo.findByScope.mockResolvedValue([]);

    await useCase.execute('leader-uid', ['leader']);

    expect(repo.findByScope).toHaveBeenCalledWith('leader:leader-uid', undefined, undefined, 52);
  });

  it('returns multiple periods mapped correctly', async () => {
    repo.findByScope.mockResolvedValue([
      makeSnap('2026-W01', 2, 0.8),
      makeSnap('2026-W02', 4, 0.9),
    ]);

    const result = await useCase.execute('admin-uid', ['super_admin']);

    expect(result.data).toHaveLength(2);
    expect(result.data[0].memberGrowth).toBe(2);
    expect(result.data[1].memberGrowth).toBe(4);
  });
});
