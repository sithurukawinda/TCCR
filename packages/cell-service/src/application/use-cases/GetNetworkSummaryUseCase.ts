import { createHttpError } from '@shared/errors';
import { Role }            from '@shared/auth-middleware';
import { ICellGroupRepository }  from '../../domain/repositories/ICellGroupRepository';
import { ICellReportRepository } from '../../domain/repositories/ICellReportRepository';
import { UserServiceClient }     from '../../infrastructure/clients/UserServiceClient';
import { monthToDateRange }      from './GetNetworkReportsUseCase';

// ── Output types ──────────────────────────────────────────────────────────────

export interface NetworkSummaryResult {
  period:    string;   // e.g. "May 2026"
  month:     string;   // e.g. "2026-05"
  scope: {
    totalCells:   number;
    totalLeaders: number;
  };
  summary: {
    cellsHeld:    number;
    reportsFiled: number;
    activeLeaders: number;
    g12Active:    number;
  };
  attendance: {
    present:         number;
    roster:          number;
    rate:            number;  // 0-1
    visitors:        number;
    avgSatisfaction: number;  // 1-6 scale, rounded to 1dp
  };
  unreportedCells: Array<{
    id:         string;
    name:       string;
    type:       string;
    leaderUid:  string;
    leaderName: string;
  }>;
  weeklyBreakdown: Array<{
    weekLabel:   string;  // "W1" … "W5"
    reportCount: number;
    attendance:  number;
  }>;
  meetingTypeBreakdown: {
    g12:      number;
    care:     number;
    children: number;
    outreach: number;
  };
  byLeader: Array<{
    leaderUid:       string;
    leaderName:      string;
    g12Uid:          string;
    g12Name:         string;
    cellCount:       number;
    reportCount:     number;
    attendance:      number;
    avgSatisfaction: number;
  }>;
}

// ── Helper ────────────────────────────────────────────────────────────────────

/** Returns the 1-based week-of-month (1–5) for a YYYY-MM-DD date string. */
function weekOfMonth(dateStr: string): number {
  const d       = new Date(dateStr);
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
  return Math.ceil((d.getDate() + firstDay.getDay()) / 7);
}

/** Format YYYY-MM as "Month YYYY" using UTC to avoid timezone issues. */
function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const date   = new Date(Date.UTC(y, m - 1, 1));
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// ── Use case ──────────────────────────────────────────────────────────────────

/**
 * Computes the full reporting summary for the Reports page.
 *
 * Scope rules (same as GetNetworkReportsUseCase):
 *   G12 leader  → ALL active cells (org-wide read access)
 *   Cell leader → only their own cell
 *   Admin/SA    → all active cells
 */
export class GetNetworkSummaryUseCase {
  constructor(
    private readonly cellRepo:   ICellGroupRepository,
    private readonly reportRepo: ICellReportRepository,
    private readonly userClient: UserServiceClient,
  ) {}

  async execute(
    callerUid:   string,
    callerRoles: Role[],
    month:       string,
  ): Promise<NetworkSummaryResult> {
    const isAdmin  = callerRoles.includes('admin') || callerRoles.includes('super_admin');
    const isG12    = callerRoles.includes('g12');
    const isLeader = callerRoles.includes('leader');

    if (!isAdmin && !isG12 && !isLeader) {
      throw createHttpError(403, 'FORBIDDEN', 'Only G12 leaders, cell leaders, and admins can view network summaries.');
    }

    // ── 1. Resolve scope ───────────────────────────────────────────────────────
    let cellFilter: { g12LeaderUid?: string; leaderUid?: string } = {};
    if (!isAdmin && !isG12) {
      // G12 — org-wide read access (same as admin); leader still scoped to own cell
      cellFilter = { leaderUid: callerUid };
    }

    const cellResult = await this.cellRepo.findAll({ limit: 100, state: 'active', ...cellFilter });
    const cells      = cellResult.items;

    // ── 2. Resolve date range from month ──────────────────────────────────────
    const { from, to } = monthToDateRange(month);

    // ── 3. Fetch all non-voided reports for the period per cell ───────────────
    const reportPages = await Promise.all(
      cells.map(cell =>
        this.reportRepo.findByPeriod(cell.id, from, to).catch(() => []),
      ),
    );
    const allReports = reportPages.flat();

    // ── 4. Core aggregations ──────────────────────────────────────────────────
    const meetReports    = allReports.filter(r => r.didMeet);
    const reportedCellIds = new Set(allReports.map(r => r.cellId));

    const cellsHeld     = new Set(meetReports.map(r => r.cellId)).size;
    const reportsFiled  = allReports.length;
    const activeLeaders = new Set(allReports.map(r => r.filledByUid)).size;
    const g12Active     = new Set(
      cells.filter(c => reportedCellIds.has(c.id)).map(c => c.g12LeaderUid).filter(Boolean),
    ).size;

    // ── 5. Attendance ─────────────────────────────────────────────────────────
    let present  = 0;
    let visitors = 0;
    let satisfactionSum   = 0;
    let satisfactionCount = 0;

    for (const r of meetReports) {
      present  += r.attendance.filter(a => a.status === 'present').length;
      visitors += r.additionalVisitors ?? 0;
      satisfactionSum   += r.satisfactionRate ?? 0;
      satisfactionCount += 1;
    }

    const roster         = cells.reduce((s, c) => s + c.memberCount, 0);
    const rate           = roster > 0 ? Math.round((present / roster) * 1000) / 1000 : 0;
    const avgSatisfaction = satisfactionCount > 0
      ? Math.round((satisfactionSum / satisfactionCount) * 10) / 10
      : 0;

    // ── 6. Unreported cells ───────────────────────────────────────────────────
    const unreportedRaw = cells.filter(c => !reportedCellIds.has(c.id));

    // ── 7. Weekly breakdown ───────────────────────────────────────────────────
    const weekMap = new Map<number, { reports: number; attendance: number }>();
    for (const r of allReports) {
      const wk    = weekOfMonth(r.date);
      const entry = weekMap.get(wk) ?? { reports: 0, attendance: 0 };
      entry.reports++;
      if (r.didMeet) {
        entry.attendance += r.attendance.filter(a => a.status === 'present').length;
      }
      weekMap.set(wk, entry);
    }
    const weeklyBreakdown = Array.from(weekMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([wk, d]) => ({ weekLabel: `W${wk}`, reportCount: d.reports, attendance: d.attendance }));

    // ── 8. Meeting type breakdown ──────────────────────────────────────────────
    const breakdown = { g12: 0, care: 0, children: 0, outreach: 0 };
    for (const r of meetReports) {
      if (r.cellType && r.cellType in breakdown) {
        (breakdown as Record<string, number>)[r.cellType]++;
      }
    }

    // ── 9. By leader aggregation ──────────────────────────────────────────────
    const leaderMap = new Map<string, {
      cellIds: Set<string>;
      reports: number;
      attendance: number;
      satisfaction: number[];
    }>();

    for (const r of allReports) {
      const entry = leaderMap.get(r.filledByUid) ?? {
        cellIds: new Set<string>(), reports: 0, attendance: 0, satisfaction: [],
      };
      entry.cellIds.add(r.cellId);
      entry.reports++;
      if (r.didMeet) {
        entry.attendance += r.attendance.filter(a => a.status === 'present').length;
        entry.satisfaction.push(r.satisfactionRate ?? 0);
      }
      leaderMap.set(r.filledByUid, entry);
    }

    // ── 10. Enrich with user profiles ─────────────────────────────────────────
    const leaderUids = Array.from(leaderMap.keys());
    const unreportedLeaderUids = unreportedRaw.map(c => c.leaderUid);
    const g12Uids = [...new Set(cells.map(c => c.g12LeaderUid).filter(Boolean))];

    const allUidsToFetch = [...new Set([...leaderUids, ...unreportedLeaderUids, ...g12Uids])];
    const profiles = await this.userClient.getMemberProfiles(allUidsToFetch);
    const profileMap = new Map(profiles.map(p => [p.uid, p]));

    // Build leader → g12 mapping from cells
    const leaderToG12 = new Map<string, string>();
    for (const c of cells) leaderToG12.set(c.leaderUid, c.g12LeaderUid);

    const byLeader = Array.from(leaderMap.entries()).map(([uid, data]) => {
      const profile    = profileMap.get(uid);
      const g12Uid     = leaderToG12.get(uid) ?? '';
      const g12Profile = profileMap.get(g12Uid);
      const sats       = data.satisfaction;
      return {
        leaderUid:       uid,
        leaderName:      profile?.displayName   || 'Unknown leader',
        g12Uid,
        g12Name:         g12Profile?.displayName || 'Unknown G12',
        cellCount:       data.cellIds.size,
        reportCount:     data.reports,
        attendance:      data.attendance,
        avgSatisfaction: sats.length > 0
          ? Math.round(sats.reduce((a, b) => a + b) / sats.length * 10) / 10
          : 0,
      };
    });

    const unreportedCells = unreportedRaw.map(c => ({
      id:         c.id,
      name:       c.name,
      type:       c.type,
      leaderUid:  c.leaderUid,
      leaderName: profileMap.get(c.leaderUid)?.displayName || 'Unknown leader',
    }));

    // ── 11. Assemble result ───────────────────────────────────────────────────
    return {
      period: monthLabel(month),
      month,
      scope: {
        totalCells:   cells.length,
        totalLeaders: new Set(cells.map(c => c.leaderUid)).size,
      },
      summary: { cellsHeld, reportsFiled, activeLeaders, g12Active },
      attendance: { present, roster, rate, visitors, avgSatisfaction },
      unreportedCells,
      weeklyBreakdown,
      meetingTypeBreakdown: breakdown,
      byLeader,
    };
  }
}
