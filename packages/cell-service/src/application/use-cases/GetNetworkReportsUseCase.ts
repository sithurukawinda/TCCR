import { createHttpError }        from '@shared/errors';
import { Role }                   from '@shared/auth-middleware';
import { ICellGroupRepository }   from '../../domain/repositories/ICellGroupRepository';
import { ICellReportRepository,
         CellReportListOptions }  from '../../domain/repositories/ICellReportRepository';
import { CellReport }             from '../../domain/entities/CellReport';

/** Convert a YYYY-MM month string to inclusive date range strings (YYYY-MM-DD). */
export function monthToDateRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const from     = `${month}-01`;
  const lastDay  = new Date(y, m, 0).getDate();
  const to       = `${month}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

export interface NetworkReportsResult {
  items:      (CellReport & { cellName: string })[];
  totalCells: number;
}

/**
 * Returns all cell reports across every cell in the caller's G12 network.
 *
 * Scope by role:
 *   G12         → reports from all cells where g12LeaderUid === callerUid
 *   Leader      → reports from their own cell (leaderUid === callerUid)
 *   Admin/SA    → reports from ALL active cells (no UID filter)
 *
 * Reports are fetched per-cell and merged, ordered by date desc.
 * Use `limit` to control how many reports per cell (default 20).
 */
export class GetNetworkReportsUseCase {
  constructor(
    private readonly cellRepo:   ICellGroupRepository,
    private readonly reportRepo: ICellReportRepository,
  ) {}

  async execute(
    opts:        CellReportListOptions & { month?: string },
    callerUid:   string,
    callerRoles: Role[],
  ): Promise<NetworkReportsResult> {
    const isAdmin  = callerRoles.includes('admin') || callerRoles.includes('super_admin');
    const isG12    = callerRoles.includes('g12');
    const isLeader = callerRoles.includes('leader');

    if (!isAdmin && !isG12 && !isLeader) {
      throw createHttpError(
        403,
        'FORBIDDEN',
        'Only G12 leaders, cell leaders, admin, and super_admin can access network reports.',
      );
    }

    // ── If month is provided, derive from/to date range (overrides explicit from/to) ──
    if (opts.month && !opts.from && !opts.to) {
      const range = monthToDateRange(opts.month);
      opts = { ...opts, from: range.from, to: range.to };
    }

    // ── Determine which cells to fetch reports from ───────────────────────────
    let cellFilter: { g12LeaderUid?: string; leaderUid?: string } = {};

    if (isAdmin) {
      cellFilter = {}; // all cells — no restriction
    } else if (isG12) {
      cellFilter = { g12LeaderUid: callerUid }; // only cells under this G12
    } else {
      cellFilter = { leaderUid: callerUid }; // only the leader's own cell
    }

    // Fetch up to 100 cells (enough for a full G12 network)
    const cellResult = await this.cellRepo.findAll({
      limit: 100,
      state: 'active',
      ...cellFilter,
    });

    // Apply optional in-memory filters (leaderUid, type, cellId)
    // These are cheap because G12 networks are small (≤100 cells)
    let cells = cellResult.items;
    if (opts.leaderUid) cells = cells.filter(c => c.leaderUid === opts.leaderUid);
    if (opts.type)      cells = cells.filter(c => c.type      === opts.type);
    if (opts.cellId)    cells = cells.filter(c => c.id        === opts.cellId);

    if (cells.length === 0) {
      return { items: [], totalCells: 0 };
    }

    // ── Fetch reports for each cell in parallel ───────────────────────────────
    const reportPages = await Promise.all(
      cells.map(cell =>
        this.reportRepo.findAll(cell.id, opts)
          .then(r => r.items.map(report => ({ ...report, cellName: cell.name })))
          .catch(() => [] as (CellReport & { cellName: string })[]), // skip failed cells
      ),
    );

    // ── Merge, filter by report-level cellType if requested, sort by date desc ──
    let allReports = (reportPages.flat() as (CellReport & { cellName: string })[])
      .sort((a, b) => b.date.localeCompare(a.date));

    // Secondary guard: ensure report.cellType matches the requested type.
    // A cell's registered type and the cellType stored on a report can differ
    // when a leader inadvertently files with a wrong type.
    if (opts.type) allReports = allReports.filter(r => r.cellType === opts.type);

    return {
      items:      allReports,
      totalCells: cells.length,
    };
  }
}
