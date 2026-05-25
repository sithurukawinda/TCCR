import { GetParticipationUseCase } from '../../../src/application/use-cases/GetParticipationUseCase';
import { IAnalyticsRepository }    from '../../../src/domain/repositories/IAnalyticsRepository';
import { AnalyticsSnapshot }       from '../../../src/domain/entities/AnalyticsSnapshot';
import { ParticipationEntry }      from '../../../src/domain/entities/AnalyticsSnapshot';

const makeRepo = (): jest.Mocked<IAnalyticsRepository> => ({
  findByScope: jest.fn(), findLatestByScope: jest.fn(),
});

const LEADERS: ParticipationEntry[] = [
  { leaderUid: 'leader-1', leaderName: 'John',  averageAttendance: 12, cellCount: 2 },
  { leaderUid: 'leader-2', leaderName: 'Mary',  averageAttendance: 8,  cellCount: 1 },
];

const makeSnap = (participationByLeader: ParticipationEntry[] = LEADERS): AnalyticsSnapshot =>
  new AnalyticsSnapshot({
    id: 'org_2026-W10', scope: 'org', periodKey: '2026-W10',
    metrics: {
      cellCount: 3, activeCells: 3, reportCount: 3,
      attendance: { present: 10, absent: 1, visitors: 0, children: 0, newAttendees: 0 },
      meetingTypeBreakdown: { g12: 1, care: 1, children: 1, outreach: 0 },
      memberGrowth: 1, participationRate: 0.85, averageSatisfaction: 4,
      participationByLeader,
    },
    computedAt: '2026-01-01T00:00:00Z',
  });

describe('GetParticipationUseCase', () => {
  let repo:    jest.Mocked<IAnalyticsRepository>;
  let useCase: GetParticipationUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new GetParticipationUseCase(repo);
  });

  it('returns participation by leader data from latest snapshot', async () => {
    repo.findLatestByScope.mockResolvedValue(makeSnap());

    const result = await useCase.execute('admin-uid', ['admin']);

    expect(result.scope).toBe('org');
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toMatchObject({
      leaderUid: 'leader-1', leaderName: 'John', averageAttendance: 12, cellCount: 2,
    });
  });

  it('returns empty data array when no snapshot exists', async () => {
    repo.findLatestByScope.mockResolvedValue(null);

    const result = await useCase.execute('admin-uid', ['admin']);

    expect(result.data).toEqual([]);
  });

  it('uses org scope for admin', async () => {
    repo.findLatestByScope.mockResolvedValue(null);

    await useCase.execute('admin-uid', ['admin']);

    expect(repo.findLatestByScope).toHaveBeenCalledWith('org');
  });

  it('uses org scope for super_admin', async () => {
    repo.findLatestByScope.mockResolvedValue(null);

    await useCase.execute('sa-uid', ['super_admin']);

    expect(repo.findLatestByScope).toHaveBeenCalledWith('org');
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

  it('returns empty participationByLeader when snapshot has none', async () => {
    repo.findLatestByScope.mockResolvedValue(makeSnap([]));

    const result = await useCase.execute('admin-uid', ['admin']);

    expect(result.data).toEqual([]);
  });
});
