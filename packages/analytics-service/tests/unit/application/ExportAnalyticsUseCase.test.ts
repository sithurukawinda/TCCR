import { ExportAnalyticsUseCase } from '../../../src/application/use-cases/ExportAnalyticsUseCase';
import { IAnalyticsRepository }   from '../../../src/domain/repositories/IAnalyticsRepository';
import { AnalyticsSnapshot }      from '../../../src/domain/entities/AnalyticsSnapshot';
import { getISOWeekKey }          from '../../../src/application/helpers/scope';

const makeRepo = (): jest.Mocked<IAnalyticsRepository> => ({
  findByScope:       jest.fn(),
  findLatestByScope: jest.fn(),
});

const makeSnap = (periodKey: string): AnalyticsSnapshot =>
  new AnalyticsSnapshot({
    id: 'org_' + periodKey, scope: 'org', periodKey,
    metrics: {
      cellCount: 3, activeCells: 3, reportCount: 6,
      attendance: { present: 20, absent: 3, visitors: 2, children: 1, newAttendees: 1 },
      meetingTypeBreakdown: { g12: 4, care: 2, children: 1, outreach: 1 },
      memberGrowth: 3, participationRate: 0.9, averageSatisfaction: 4.2,
      participationByLeader: [
        { leaderUid: 'leader-1', leaderName: 'John', averageAttendance: 8, cellCount: 1 },
      ],
    },
    computedAt: '2026-01-01T00:00:00Z',
  });

describe('ExportAnalyticsUseCase', () => {
  let repo:    jest.Mocked<IAnalyticsRepository>;
  let useCase: ExportAnalyticsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    repo    = makeRepo();
    useCase = new ExportAnalyticsUseCase(repo);
  });

  it('exports cells-weekly as CSV with correct headers', async () => {
    repo.findByScope.mockResolvedValue([makeSnap(getISOWeekKey(new Date()))]);

    const csv = await useCase.execute('cells-weekly', 'uid-1', ['admin'], { weeks: '4' });

    expect(csv.startsWith('periodKey,cellCount,activeCells,reportCount')).toBe(true);
    const lines = csv.split('\n');
    expect(lines.length).toBeGreaterThan(1);
  });

  it('exports attendance as CSV with correct headers', async () => {
    repo.findByScope.mockResolvedValue([makeSnap(getISOWeekKey(new Date()))]);

    const csv = await useCase.execute('attendance', 'uid-1', ['admin'], {});

    expect(csv.startsWith('periodKey,present,absent,visitors,children,newAttendees')).toBe(true);
  });

  it('exports meeting-types as CSV', async () => {
    repo.findLatestByScope.mockResolvedValue(makeSnap(getISOWeekKey(new Date())));

    const csv = await useCase.execute('meeting-types', 'uid-1', ['admin'], {});

    expect(csv).toContain('type,count');
    expect(csv).toContain('g12,4');
  });

  it('exports growth as CSV', async () => {
    repo.findByScope.mockResolvedValue([makeSnap(getISOWeekKey(new Date()))]);

    const csv = await useCase.execute('growth', 'uid-1', ['admin'], {});

    expect(csv.startsWith('periodKey,memberGrowth,participationRate')).toBe(true);
  });

  it('exports participation as CSV', async () => {
    repo.findLatestByScope.mockResolvedValue(makeSnap(getISOWeekKey(new Date())));

    const csv = await useCase.execute('participation', 'uid-1', ['admin'], {});

    expect(csv.startsWith('leaderUid,leaderName,averageAttendance,cellCount')).toBe(true);
    expect(csv).toContain('leader-1');
  });

  it('returns empty rows when no snapshot data', async () => {
    repo.findByScope.mockResolvedValue([]);
    repo.findLatestByScope.mockResolvedValue(null);

    const csv = await useCase.execute('cells-weekly', 'uid-1', ['admin'], { weeks: '2' });

    const lines = csv.split('\n').filter(l => l.trim());
    expect(lines[0]).toBe('periodKey,cellCount,activeCells,reportCount');
    // week rows have zeros for missing data
    expect(lines[1]).toMatch(/^\d{4}-W\d{2},0,0,0$/);
  });
});
