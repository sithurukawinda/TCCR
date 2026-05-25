import { IAnalyticsRepository } from '../../domain/repositories/IAnalyticsRepository';
import { resolveScope, lastNWeekKeys } from '../helpers/scope';
import { createHttpError }  from '@shared/errors';
import { Role }             from '@shared/auth-middleware';

export type ChartType = 'cells-weekly' | 'attendance' | 'meeting-types' | 'growth' | 'participation';

export class ExportAnalyticsUseCase {
  constructor(private readonly repo: IAnalyticsRepository) {}

  async execute(
    chart:  ChartType,
    uid:    string,
    roles:  Role[],
    params: Record<string, string | undefined>,
  ): Promise<string> {
    const scope = resolveScope(uid, roles);

    switch (chart) {
      case 'cells-weekly': {
        const weeks     = Math.min(Number(params.weeks ?? 12), 52);
        const weekKeys  = lastNWeekKeys(weeks);
        const snapshots = await this.repo.findByScope(scope, weekKeys[0], weekKeys[weekKeys.length - 1], weeks);
        const byKey     = new Map(snapshots.map(s => [s.periodKey, s]));
        const rows      = weekKeys.map(k => {
          const m = byKey.get(k)?.metrics;
          return [k, m?.cellCount ?? 0, m?.activeCells ?? 0, m?.reportCount ?? 0].join(',');
        });
        return 'periodKey,cellCount,activeCells,reportCount\n' + rows.join('\n');
      }

      case 'attendance': {
        const snaps = await this.repo.findByScope(scope, params.from, params.to, 52);
        const rows  = snaps.map(s => {
          const a = s.metrics.attendance;
          return [s.periodKey, a.present, a.absent, a.visitors, a.children, a.newAttendees].join(',');
        });
        return 'periodKey,present,absent,visitors,children,newAttendees\n' + rows.join('\n');
      }

      case 'meeting-types': {
        const snap = await this.repo.findLatestByScope(scope);
        const b    = snap?.metrics.meetingTypeBreakdown ?? { g12: 0, care: 0, children: 0, outreach: 0 };
        return 'type,count\ng12,' + b.g12 + '\ncare,' + b.care + '\nchildren,' + b.children + '\noutreach,' + b.outreach;
      }

      case 'growth': {
        const snaps = await this.repo.findByScope(scope, params.from, params.to, 52);
        const rows  = snaps.map(s => [s.periodKey, s.metrics.memberGrowth, s.metrics.participationRate].join(','));
        return 'periodKey,memberGrowth,participationRate\n' + rows.join('\n');
      }

      case 'participation': {
        const snap = await this.repo.findLatestByScope(scope);
        const rows = (snap?.metrics.participationByLeader ?? []).map(p =>
          [p.leaderUid, p.leaderName, p.averageAttendance, p.cellCount].join(','),
        );
        return 'leaderUid,leaderName,averageAttendance,cellCount\n' + rows.join('\n');
      }

      default:
        throw createHttpError(400, 'VALIDATION_ERROR', 'Unknown chart type.');
    }
  }
}
