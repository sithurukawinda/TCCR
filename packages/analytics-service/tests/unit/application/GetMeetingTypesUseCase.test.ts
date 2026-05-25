import { GetMeetingTypesUseCase } from '../../../src/application/use-cases/GetMeetingTypesUseCase';
import { IAnalyticsRepository }   from '../../../src/domain/repositories/IAnalyticsRepository';
import { AnalyticsSnapshot }      from '../../../src/domain/entities/AnalyticsSnapshot';

const makeRepo = (): jest.Mocked<IAnalyticsRepository> => ({
  findByScope: jest.fn(), findLatestByScope: jest.fn(),
});

const makeSnap = (periodKey: string, breakdown = { g12: 2, care: 3, children: 1, outreach: 0 }): AnalyticsSnapshot =>
  new AnalyticsSnapshot({
    id: `org_${periodKey}`, scope: 'org', periodKey,
    metrics: {
      cellCount: 6, activeCells: 6, reportCount: 6,
      attendance: { present: 10, absent: 1, visitors: 0, children: 0, newAttendees: 0 },
      meetingTypeBreakdown: breakdown,
      memberGrowth: 1, participationRate: 0.9, averageSatisfaction: 4,
      participationByLeader: [],
    },
    computedAt: '2026-01-01T00:00:00Z',
  });

describe('GetMeetingTypesUseCase', () => {
  let repo:    jest.Mocked<IAnalyticsRepository>;
  let useCase: GetMeetingTypesUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new GetMeetingTypesUseCase(repo);
  });

  it('returns breakdown from the latest snapshot', async () => {
    repo.findLatestByScope.mockResolvedValue(makeSnap('2026-W10'));

    const result = await useCase.execute('admin-uid', ['admin']);

    expect(result.scope).toBe('org');
    expect(result.period).toBe('2026-W10');
    expect(result.breakdown).toMatchObject({ g12: 2, care: 3, children: 1, outreach: 0 });
  });

  it('returns zero breakdown when no snapshot exists', async () => {
    repo.findLatestByScope.mockResolvedValue(null);

    const result = await useCase.execute('admin-uid', ['admin']);

    expect(result.breakdown).toEqual({ g12: 0, care: 0, children: 0, outreach: 0 });
  });

  it('uses current ISO week as period when no snapshot exists', async () => {
    repo.findLatestByScope.mockResolvedValue(null);

    const result = await useCase.execute('admin-uid', ['admin']);

    expect(result.period).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('uses leader scope for leader role', async () => {
    repo.findLatestByScope.mockResolvedValue(null);

    await useCase.execute('leader-uid', ['leader']);

    expect(repo.findLatestByScope).toHaveBeenCalledWith('leader:leader-uid');
  });

  it('uses g12 scope for g12 role', async () => {
    repo.findLatestByScope.mockResolvedValue(null);

    await useCase.execute('g12-uid', ['g12']);

    expect(repo.findLatestByScope).toHaveBeenCalledWith('g12:g12-uid');
  });

  it('uses org scope for super_admin', async () => {
    repo.findLatestByScope.mockResolvedValue(null);

    await useCase.execute('sa-uid', ['super_admin']);

    expect(repo.findLatestByScope).toHaveBeenCalledWith('org');
  });
});
