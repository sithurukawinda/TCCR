import { GetWeeklyCellsUseCase }   from '../../../src/application/use-cases/GetWeeklyCellsUseCase';
import { IAnalyticsRepository }    from '../../../src/domain/repositories/IAnalyticsRepository';
import { AnalyticsSnapshot }       from '../../../src/domain/entities/AnalyticsSnapshot';
import { getISOWeekKey }           from '../../../src/application/helpers/scope';

const makeRepo = (): jest.Mocked<IAnalyticsRepository> => ({
  findByScope:       jest.fn(),
  findLatestByScope: jest.fn(),
});

const makeSnap = (periodKey: string, cellCount: number, scope = 'org'): AnalyticsSnapshot =>
  new AnalyticsSnapshot({
    id: scope + '_' + periodKey, scope, periodKey,
    metrics: {
      cellCount, activeCells: cellCount, reportCount: cellCount * 2,
      attendance: { present: 10, absent: 2, visitors: 1, children: 0, newAttendees: 1 },
      meetingTypeBreakdown: { g12: 1, care: 0, children: 0, outreach: 0 },
      memberGrowth: 2, participationRate: 0.85, averageSatisfaction: 4,
      participationByLeader: [],
    },
    computedAt: '2026-01-01T00:00:00Z',
  });

describe('GetWeeklyCellsUseCase', () => {
  let repo:    jest.Mocked<IAnalyticsRepository>;
  let useCase: GetWeeklyCellsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new GetWeeklyCellsUseCase(repo);
  });

  it('returns 12 weeks of data with org scope for admin', async () => {
    const currentWeek = getISOWeekKey(new Date());
    repo.findByScope.mockResolvedValue([makeSnap(currentWeek, 5, 'org')]);

    const result = await useCase.execute('uid-1', ['admin'], 12);

    expect(result.scope).toBe('org');
    expect(result.periodType).toBe('weekly');
    expect(result.data).toHaveLength(12);
    expect(repo.findByScope).toHaveBeenCalledWith('org', expect.any(String), expect.any(String), 12);
  });

  it('fills missing weeks with zeros', async () => {
    repo.findByScope.mockResolvedValue([]); // no snapshots yet

    const result = await useCase.execute('uid-1', ['admin'], 4);

    expect(result.data).toHaveLength(4);
    expect(result.data.every(d => d.cellCount === 0 && d.activeCells === 0)).toBe(true);
  });

  it('uses leader scope for leader role', async () => {
    repo.findByScope.mockResolvedValue([]);

    await useCase.execute('leader-uid', ['member', 'leader'], 4);

    expect(repo.findByScope).toHaveBeenCalledWith('leader:leader-uid', expect.any(String), expect.any(String), 4);
  });

  it('uses g12 scope for g12 role', async () => {
    repo.findByScope.mockResolvedValue([]);

    await useCase.execute('g12-uid', ['member', 'leader', 'g12'], 4);

    expect(repo.findByScope).toHaveBeenCalledWith('g12:g12-uid', expect.any(String), expect.any(String), 4);
  });

  it('caps weeks at 52', async () => {
    repo.findByScope.mockResolvedValue([]);

    const result = await useCase.execute('uid-1', ['admin'], 100);

    expect(result.data).toHaveLength(52);
  });

  it('fills known snapshot data into matching week slot', async () => {
    const currentWeek = getISOWeekKey(new Date());
    repo.findByScope.mockResolvedValue([makeSnap(currentWeek, 7, 'org')]);

    const result = await useCase.execute('uid-1', ['admin'], 4);

    const current = result.data.find(d => d.periodKey === currentWeek);
    expect(current?.cellCount).toBe(7);
  });
});
